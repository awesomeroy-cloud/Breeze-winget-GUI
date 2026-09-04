use std::collections::HashMap;

/// Computes the approximate monospace display column width for a Unicode character.
///
/// # Technical Nuance: Visual Character Width (`char_width`)
/// The `winget` CLI formats tabular command outputs (`search`, `list`, `upgrade`) as fixed-width
/// monospace terminal text separated by whitespace columns.
/// In terminal font rendering:
/// - Standard ASCII and half-width Latin glyphs occupy 1 display column.
/// - East Asian Wide (CJK) characters (Chinese ideographs, Japanese kana, Korean hangul, and full-width
///   punctuation, starting at Unicode scalar value `U+2E80`) occupy 2 display columns in terminal monospace fonts.
///
/// Standard Rust string operations present two pitfalls:
/// 1. `str::len()` measures UTF-8 byte length (a Chinese character is 3 bytes).
/// 2. `chars().count()` measures Unicode scalar count (a Chinese character is 1 scalar).
///
/// Neither reflects the 2-column visual layout rendered in terminal emulators. Slicing table columns
/// by character count causes severe rightward column drift when package names contain CJK characters.
/// Testing `(c as u32) > 0x2E80` allows determining whether a glyph spans 1 or 2 visual columns,
/// enabling robust monospace alignment across localized table outputs.
pub fn char_width(c: char) -> usize {
    if c as u32 > 0x2E80 { 2 } else { 1 }
}

/// Identifies the starting visual column positions of table headers by analyzing whitespace transitions.
///
/// Scans the header string line and records visual positions where non-whitespace words start.
/// Requires at least 2 consecutive whitespace characters to denote a column boundary, allowing
/// single spaces within compound header titles (e.g., "Release Date").
pub fn find_column_starts(header: &str) -> Vec<usize> {
    let mut starts = Vec::new();
    let chars: Vec<char> = header.chars().collect();
    let mut i = 0;
    let mut visual_pos = 0;

    while i < chars.len() {
        if !chars[i].is_whitespace() {
            starts.push(visual_pos);
            // Skip to end of this column header
            while i < chars.len() && !chars[i].is_whitespace() {
                visual_pos += char_width(chars[i]);
                i += 1;
            }
            // Skip whitespace between columns (need at least 2 spaces to be a separator)
            let ws_visual_start = visual_pos;
            while i < chars.len() && chars[i].is_whitespace() {
                visual_pos += 1; // space is width 1
                i += 1;
            }
            // If only 1 space, it's part of the same column name
            if visual_pos - ws_visual_start == 1 && i < chars.len() {
                continue;
            }
        } else {
            visual_pos += 1;
            i += 1;
        }
    }

    starts
}

/// Extracts column substrings from a data row using visual column coordinate boundaries.
///
/// # Technical Nuance: Visual-to-Character Coordinate Mapping
/// Because wide characters occupy 2 visual columns but only 1 `char` index, fixed visual
/// column boundaries (computed from the header row) cannot be directly applied as `char` slices.
///
/// This function constructs an index mapping vector (`visual_to_char`) where each wide character's
/// `char` index is repeated according to its display width (`char_width`). Visual start and end
/// column offsets are then translated into exact character indices:
/// ```text
/// Visual column:  0  1  2  3  4  5  6  7  8
/// Row content:   [名 (width 2)] [称 (width 2)]  I  d
/// Index mapping:  0  0  1  1  2  3  ...
/// ```
/// This translation guarantees that even with mixed English and CJK package names, column
/// boundaries align without distortion or boundary panics.
pub fn extract_columns(line: &str, col_starts: &[usize]) -> Vec<String> {
    let chars: Vec<char> = line.chars().collect();
    let mut cols = Vec::new();

    // Map visual positions to char indices for this line
    let mut visual_to_char = Vec::with_capacity(line.len() * 2);
    for (idx, &c) in chars.iter().enumerate() {
        let w = char_width(c);
        for _ in 0..w {
            visual_to_char.push(idx);
        }
    }
    // Add a terminator index
    visual_to_char.push(chars.len());

    for (i, &start_visual) in col_starts.iter().enumerate() {
        let end_visual = if i + 1 < col_starts.len() {
            col_starts[i + 1]
        } else {
            visual_to_char.len() - 1
        };

        if start_visual >= visual_to_char.len() - 1 {
            cols.push(String::new());
        } else {
            let start_char = visual_to_char[start_visual];
            let actual_end_visual = end_visual.min(visual_to_char.len() - 1);
            let end_char = visual_to_char[actual_end_visual];

            let val: String = chars[start_char..end_char].iter().collect();
            cols.push(val.trim().to_string());
        }
    }

    cols
}

/// Parses fixed-width tabular output emitted by `winget` CLI into key-value row maps.
///
/// Handles carriage return stripping for lines rewritten in-place, locates the dashed
/// delimiter row (`------`), extracts header titles, and slices each data row accordingly.
pub fn parse_table_as_map(output: &str) -> Vec<HashMap<String, String>> {
    // Strip carriage return overwrite artifacts
    let lines: Vec<&str> = output
        .lines()
        .map(|l| match l.rfind('\r') {
            Some(idx) => &l[idx + 1..],
            None => l,
        })
        .collect();

    // Find the separator line (all dashes)
    let sep_idx = lines.iter().position(|l| {
        let trimmed = l.trim();
        !trimmed.is_empty() && trimmed.chars().all(|c| c == '-')
    });

    let sep_idx = match sep_idx {
        Some(idx) => idx,
        None => return vec![],
    };

    if sep_idx == 0 {
        return vec![];
    }

    let header_line = lines[sep_idx - 1];
    let col_starts = find_column_starts(header_line);
    let headers = extract_columns(header_line, &col_starts);

    // Parse data lines
    let mut rows = Vec::new();
    for line in &lines[sep_idx + 1..] {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with('<')
            || trimmed.ends_with("可用。")
            || trimmed.ends_with("available.")
        {
            continue;
        }

        let vals = extract_columns(line, &col_starts);
        let mut map = HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            if let Some(val) = vals.get(i) {
                map.insert(header.clone(), val.clone());
            }
        }
        if !map.is_empty() {
            rows.push(map);
        }
    }

    rows
}

/// Retrieves a field value from a row map by querying an ordered list of candidate keys.
///
/// Supports both English and localized Chinese column headers (e.g., `["Name", "名称"]`).
pub fn map_value(m: &HashMap<String, String>, keys: &[&str]) -> String {
    keys.iter()
        .find_map(|key| m.get(*key))
        .cloned()
        .unwrap_or_default()
}

/// Retrieves an optional non-empty field value from a row map by querying candidate keys.
///
/// Returns `None` if all matching keys are absent or contain empty strings.
pub fn map_optional_value(m: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| m.get(*key))
        .cloned()
        .filter(|s| !s.is_empty())
}

/// Extracts a metadata value from a detail line by checking an ordered list of candidate prefixes.
///
/// Resolves both English and localized prefixes (e.g. `["Publisher:", "发布者:", "发行商:"]`).
pub fn extract_field(line: &str, prefixes: &[&str]) -> Option<String> {
    for prefix in prefixes {
        if let Some(stripped) = line.strip_prefix(prefix) {
            return Some(stripped.trim().to_string());
        }
    }
    None
}

/// Parses the output of `winget show <id> --versions` into a list of version strings.
pub fn parse_version_list(output: &str) -> Vec<String> {
    let lines: Vec<&str> = output
        .lines()
        .map(|l| match l.rfind('\r') {
            Some(idx) => &l[idx + 1..],
            None => l,
        })
        .collect();

    let sep_idx = lines.iter().position(|l| {
        let trimmed = l.trim();
        !trimmed.is_empty() && trimmed.chars().all(|c| c == '-')
    });

    if let Some(idx) = sep_idx {
        lines
            .iter()
            .skip(idx + 1)
            .map(|l| l.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        Vec::new()
    }
}

/// Checks whether an installed package entry represents an unmanaged legacy
/// Add/Remove Programs (ARP) registry item that should be filtered out.
///
/// # Technical Nuance: Legacy ARP Registry Filtering
/// When `winget list` executes, it enumerates both official winget repository packages
/// and unmanaged Windows registry entries from Add/Remove Programs (ARP).
/// When an entry has no repository source (`source.is_empty()` or `source == "-"`) and its
/// synthetic ID matches its display name exactly (`id == name`), it is typically an unmanaged
/// legacy installer entry lacking reliable manifest metadata, silent uninstall switches,
/// or upgrade tracking.
///
/// Breeze filters out these synthetic legacy entries to prevent cluttering the installed list
/// with unmanageable system components.
pub fn is_legacy_arp_entry(id: &str, name: &str, source: Option<&str>) -> bool {
    let src = source.unwrap_or("");
    if src.is_empty() || src == "-" {
        return id == name;
    }
    false
}
