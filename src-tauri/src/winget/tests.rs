use super::parser::{
    char_width, extract_columns, extract_field, find_column_starts, is_legacy_arp_entry,
    parse_table_as_map, parse_version_list,
};
use super::process::{decode_command_bytes, format_command_failure};
use super::progress::extract_progress_from_line;
use super::types::{CommandOutput, WingetSettings};

#[test]
fn parses_english_winget_table() {
    let output = "\
Name                 Id                           Version      Available    Source
--------------------------------------------------------------------------------
Google Chrome        Google.Chrome                125.0.0      126.0.0      winget
Visual Studio Code   Microsoft.VisualStudioCode   1.99.3       1.100.0      winget
";

    let rows = parse_table_as_map(output);

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].get("Name").map(String::as_str), Some("Google Chrome"));
    assert_eq!(rows[0].get("Id").map(String::as_str), Some("Google.Chrome"));
    assert_eq!(rows[0].get("Version").map(String::as_str), Some("125.0.0"));
    assert_eq!(rows[0].get("Available").map(String::as_str), Some("126.0.0"));
    assert_eq!(rows[0].get("Source").map(String::as_str), Some("winget"));
    assert_eq!(
        rows[1].get("Id").map(String::as_str),
        Some("Microsoft.VisualStudioCode")
    );
}

#[test]
fn settings_generate_expected_winget_args() {
    let settings = WingetSettings {
        install_scope: "user".to_string(),
        install_architecture: "x64".to_string(),
        install_location: "C:\\Tools\\App".to_string(),
        install_force: true,
        upgrade_include_unknown: true,
        upgrade_force: true,
        uninstall_purge: true,
        search_exact: true,
        search_source: "msstore".to_string(),
        ..WingetSettings::default()
    };

    assert_eq!(
        settings.install_args(),
        vec![
            "--silent",
            "--scope",
            "user",
            "--architecture",
            "x64",
            "--location",
            "C:\\Tools\\App",
            "--force"
        ]
    );
    assert_eq!(
        settings.upgrade_args(),
        vec!["--silent", "--include-unknown", "--force"]
    );
    assert_eq!(settings.uninstall_args(), vec!["--silent", "--purge"]);
    assert_eq!(
        settings.search_args(),
        vec!["--count", "50", "--exact", "--source", "msstore"]
    );
}

#[test]
fn command_output_combines_stdout_and_stderr() {
    let output = CommandOutput {
        stdout: "stdout text".to_string(),
        stderr: "stderr text".to_string(),
        success: false,
        status_code: Some(7),
    };

    assert_eq!(output.combined_output(), "stdout text\nstderr text");
    let message = format_command_failure("winget", &["search".to_string()], &output);
    assert!(message.contains("exit code 7"));
    assert!(message.contains("stdout text"));
    assert!(message.contains("stderr text"));
}

#[test]
fn char_width_distinguishes_ascii_and_cjk() {
    // Single-width ASCII characters
    assert_eq!(char_width('a'), 1);
    assert_eq!(char_width('Z'), 1);
    assert_eq!(char_width('0'), 1);
    assert_eq!(char_width(' '), 1);
    assert_eq!(char_width('-'), 1);
    assert_eq!(char_width('.'), 1);

    // Double-width CJK characters (> 0x2E80)
    assert_eq!(char_width('名'), 2);
    assert_eq!(char_width('称'), 2);
    assert_eq!(char_width('中'), 2);
    assert_eq!(char_width('文'), 2);
    assert_eq!(char_width('微'), 2);
    assert_eq!(char_width('信'), 2);
}

#[test]
fn parses_cjk_winget_table() {
    let output = "\
名称         Id                   版本     可用     源
--------------------------------------------------------
微信         Tencent.WeChat       3.9.0    3.9.1    winget
网易云音乐   NetEase.CloudMusic   2.10.0   2.10.1   winget
";

    let rows = parse_table_as_map(output);

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].get("名称").map(String::as_str), Some("微信"));
    assert_eq!(rows[0].get("Id").map(String::as_str), Some("Tencent.WeChat"));
    assert_eq!(rows[0].get("版本").map(String::as_str), Some("3.9.0"));
    assert_eq!(rows[0].get("可用").map(String::as_str), Some("3.9.1"));
    assert_eq!(rows[0].get("源").map(String::as_str), Some("winget"));

    assert_eq!(rows[1].get("名称").map(String::as_str), Some("网易云音乐"));
    assert_eq!(
        rows[1].get("Id").map(String::as_str),
        Some("NetEase.CloudMusic")
    );
}

#[test]
fn extract_columns_aligns_wide_characters() {
    let header = "Name       Id       Version";
    let starts = find_column_starts(header);
    assert_eq!(starts.len(), 3);

    // Row containing wide CJK characters in column 1
    // "微信" has 2 CJK chars = visual width 4
    let row = "微信       Tencent  1.0.0";
    let cols = extract_columns(row, &starts);

    assert_eq!(cols.len(), 3);
    assert_eq!(cols[0], "微信");
    assert_eq!(cols[1], "Tencent");
    assert_eq!(cols[2], "1.0.0");
}

#[test]
fn progress_heuristics_percentage() {
    // Standard percentage indicators
    assert_eq!(extract_progress_from_line("Download: 45%"), Some(45.0));
    assert_eq!(
        extract_progress_from_line("██████████████ 85.5% [10.0 MB / 12.0 MB]"),
        Some(85.5)
    );
    assert_eq!(extract_progress_from_line("100%"), Some(100.0));
    assert_eq!(extract_progress_from_line("0.0%"), Some(0.0));
}

#[test]
fn progress_heuristics_block_counting() {
    // 8 filled blocks out of 10 total = 80.0%
    let line = "████████▒▒";
    let progress = extract_progress_from_line(line);
    assert!(progress.is_some());
    let val = progress.unwrap();
    assert!((val - 80.0).abs() < 0.01);
}

#[test]
fn progress_heuristics_phase_keywords() {
    assert_eq!(
        extract_progress_from_line("正在安装程序包..."),
        Some(100.0)
    );
    assert_eq!(
        extract_progress_from_line("Installing Microsoft.VisualStudioCode..."),
        Some(100.0)
    );
    assert_eq!(
        extract_progress_from_line("正在卸载旧版本..."),
        Some(100.0)
    );
    assert_eq!(
        extract_progress_from_line("Starting uninstall process..."),
        Some(100.0)
    );
}

#[test]
fn legacy_arp_filter_identifies_unmanaged_apps() {
    // Legacy registry app: no source and id == name
    assert!(is_legacy_arp_entry(
        "OldApp",
        "OldApp",
        Some("")
    ));
    assert!(is_legacy_arp_entry(
        "OldApp",
        "OldApp",
        Some("-")
    ));
    assert!(is_legacy_arp_entry(
        "OldApp",
        "OldApp",
        None
    ));

    // Managed winget package: has source
    assert!(!is_legacy_arp_entry(
        "Google.Chrome",
        "Google.Chrome",
        Some("winget")
    ));

    // Real package with different id and name even if source is missing
    assert!(!is_legacy_arp_entry(
        "Git.Git",
        "Git",
        Some("-")
    ));
}

#[test]
fn extract_field_localized_prefixes() {
    let en_line = "Publisher: Microsoft Corporation";
    let zh_line = "发布者: 微软公司";
    let alt_line = "发行商: Valve";

    let prefixes = &["Publisher:", "发布者:", "发行商:"];
    assert_eq!(
        extract_field(en_line, prefixes),
        Some("Microsoft Corporation".to_string())
    );
    assert_eq!(
        extract_field(zh_line, prefixes),
        Some("微软公司".to_string())
    );
    assert_eq!(
        extract_field(alt_line, prefixes),
        Some("Valve".to_string())
    );
    assert_eq!(extract_field("Unknown: None", prefixes), None);
}

#[test]
fn parses_version_list_with_dashes() {
    let output = "\
Version
-------------------
1.99.3
1.99.2
1.99.1
";
    let versions = parse_version_list(output);
    assert_eq!(versions, vec!["1.99.3", "1.99.2", "1.99.1"]);

    let empty_output = "No versions found";
    let empty_versions = parse_version_list(empty_output);
    assert!(empty_versions.is_empty());
}

#[test]
fn dual_encoding_decodes_utf8_and_gbk() {
    // Valid UTF-8 string
    let utf8_text = "Visual Studio Code 微软";
    let utf8_bytes = utf8_text.as_bytes();
    assert_eq!(decode_command_bytes(utf8_bytes), utf8_text);

    // GBK encoded bytes for "中文测试"
    // "中" = 0xD6 0xD0, "文" = 0xCE 0xC4, "测" = 0xB2 0xE2, "试" = 0xCA 0xD4
    let gbk_bytes = [0xD6, 0xD0, 0xCE, 0xC4, 0xB2, 0xE2, 0xCA, 0xD4];
    assert_eq!(decode_command_bytes(&gbk_bytes), "中文测试");
}

#[test]
fn stress_char_width_ascii_cjk_boundary() {
    // 1. Pure ASCII: all printable ASCII characters (0x20 to 0x7E) must have width 1
    for b in 0x20u8..=0x7Eu8 {
        assert_eq!(char_width(b as char), 1, "ASCII char {} should have width 1", b as char);
    }
    // ASCII control chars (tab, newline, null)
    assert_eq!(char_width('\t'), 1);
    assert_eq!(char_width('\n'), 1);
    assert_eq!(char_width('\0'), 1);

    // 2. Pure CJK:
    // Chinese characters
    let cjk_chars = ['中', '国', '微', '软', '包', '管', '理', '器', '一', '龥'];
    for &c in &cjk_chars {
        assert_eq!(char_width(c), 2, "Chinese char {} should have width 2", c);
    }
    // Japanese Hiragana & Katakana
    let japanese_chars = ['あ', 'い', 'う', 'え', 'お', 'ア', 'イ', 'ウ', 'エ', 'オ', '日', '本', '語'];
    for &c in &japanese_chars {
        assert_eq!(char_width(c), 2, "Japanese char {} should have width 2", c);
    }
    // Korean Hangul Syllables (modern Korean)
    let korean_syllables = ['한', '글', '안', '녕', '하', '세', '요', '가', '힣'];
    for &c in &korean_syllables {
        assert_eq!(char_width(c), 2, "Korean syllable {} should have width 2", c);
    }
    // Korean Hangul Compatibility Jamo (> 0x2E80)
    assert_eq!(char_width('ㄱ'), 2);
    assert_eq!(char_width('ㅏ'), 2);

    // 3. Boundary codepoints around 0x2E80:
    // 0x2E7F (just below boundary): width 1
    let char_2e7f = char::from_u32(0x2E7F).unwrap();
    assert_eq!(char_width(char_2e7f), 1);

    // 0x2E80 (CJK RADICAL REPEAT): c as u32 > 0x2E80 is false, returns 1
    let char_2e80 = char::from_u32(0x2E80).unwrap();
    assert_eq!(char_width(char_2e80), 1, "0x2E80 boundary condition returns 1");

    // 0x2E81 (CJK RADICAL CLIFF): c as u32 > 0x2E80 is true, returns 2
    let char_2e81 = char::from_u32(0x2E81).unwrap();
    assert_eq!(char_width(char_2e81), 2, "0x2E81 returns 2");

    // High codepoints & Private Use Area
    assert_eq!(char_width('\u{E000}'), 2);
    assert_eq!(char_width('\u{10FFFF}'), 2);

    // Fullwidth space
    assert_eq!(char_width('\u{3000}'), 2);

    // Emojis (> 0x2E80)
    assert_eq!(char_width('🚀'), 2);
    assert_eq!(char_width('📦'), 2);
}

#[test]
fn stress_extract_columns_mixed_and_edge_cases() {
    // 1. Pure ASCII extraction
    let header = "Name                 Id                           Version";
    let starts = find_column_starts(header);
    let row_ascii = "Google Chrome        Google.Chrome                125.0.0";
    let cols = extract_columns(row_ascii, &starts);
    assert_eq!(cols, vec!["Google Chrome", "Google.Chrome", "125.0.0"]);

    // 2. Pure CJK extraction
    let header_cjk = "名称                 标识                         版本";
    let starts_cjk = find_column_starts(header_cjk);
    let row_cjk = "微信                 Tencent.WeChat               3.9.0";
    let cols_cjk = extract_columns(row_cjk, &starts_cjk);
    assert_eq!(cols_cjk, vec!["微信", "Tencent.WeChat", "3.9.0"]);

    // 3. Mixed ASCII and CJK in single columns
    let row_mixed = "VS Code 微软版       Microsoft.VisualStudioCode   1.99.3";
    let cols_mixed = extract_columns(row_mixed, &starts);
    assert_eq!(cols_mixed, vec!["VS Code 微软版", "Microsoft.VisualStudioCode", "1.99.3"]);

    // 4. Edge cases: Empty string
    let empty_cols = extract_columns("", &starts);
    assert_eq!(empty_cols, vec!["", "", ""]);

    // Edge case: Empty col_starts
    let no_starts = extract_columns("Some line", &[]);
    assert!(no_starts.is_empty());

    // Edge case: col_starts far exceeding line length
    let short_line = "Hi";
    let far_starts = vec![0, 10, 20];
    let far_cols = extract_columns(short_line, &far_starts);
    assert_eq!(far_cols, vec!["Hi", "", ""]);

    // Edge case: Tabs in line
    let tab_line = "ColA\tColB";
    let tab_starts = vec![0, 4];
    let tab_cols = extract_columns(tab_line, &tab_starts);
    assert_eq!(tab_cols.len(), 2);

    // Edge case: Unsorted col_starts (test panic behavior via catch_unwind)
    let panic_res = std::panic::catch_unwind(|| {
        extract_columns("Test Line Content", &[10, 2])
    });
    // Unsorted col_starts [10, 2] causes slice index start > end panic
    assert!(panic_res.is_err(), "Unsorted col_starts [10, 2] panics on slice index start > end");
}

#[test]
fn stress_parse_table_malformed_separators() {
    // 1. Discontinuous dashes separated by spaces
    let short_dashes = "\
Name Id
---  --
A    B
";
    let rows = parse_table_as_map(short_dashes);
    assert!(rows.is_empty(), "Discontinuous dashes with spaces do not qualify as separator");

    // 2. Solid line of dashes of varying length
    let solid_5 = "\
Name  Id
-----
A     B
";
    let rows_5 = parse_table_as_map(solid_5);
    assert_eq!(rows_5.len(), 1);
    assert_eq!(rows_5[0].get("Name").map(String::as_str), Some("A"));
    assert_eq!(rows_5[0].get("Id").map(String::as_str), Some("B"));

    // 3. Missing separator line entirely
    let no_sep = "\
Name    Id
AppA    1.0
AppB    2.0
";
    let rows_no_sep = parse_table_as_map(no_sep);
    assert!(rows_no_sep.is_empty(), "Table with missing separator returns empty vec");

    // 4. Separator at index 0 (no header line above it)
    let sep_at_0 = "\
-------------------
AppA    1.0
";
    let rows_sep_0 = parse_table_as_map(sep_at_0);
    assert!(rows_sep_0.is_empty(), "Separator at line 0 returns empty vec");

    // 5. Separator line with mixed characters (e.g. dashes and equals)
    let mixed_sep = "\
Name    Id
-------=====-------
AppA    1.0
";
    let rows_mixed_sep = parse_table_as_map(mixed_sep);
    assert!(rows_mixed_sep.is_empty(), "Mixed non-dash separator line is rejected");
}

#[test]
fn stress_parse_table_header_trailing_spaces() {
    let output = "\
Name                 Id                           Version       \n\
----------------------------------------------------------------\n\
Google Chrome        Google.Chrome                125.0.0       \n\
";
    let rows = parse_table_as_map(output);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].get("Name").map(String::as_str), Some("Google Chrome"));
    assert_eq!(rows[0].get("Id").map(String::as_str), Some("Google.Chrome"));
    assert_eq!(rows[0].get("Version").map(String::as_str), Some("125.0.0"));
    assert_eq!(rows[0].len(), 3);
}

#[test]
fn stress_parse_table_fewer_or_more_columns() {
    let output = "\
Name                 Id                           Version
---------------------------------------------------------
AppNormal            Normal.App                   1.0.0
AppShort
AppExtra             Extra.App                    2.0.0        extra_source_info
<more items>
5 items available.
还有 3 个可用。
";
    let rows = parse_table_as_map(output);
    assert_eq!(rows.len(), 3);

    // Row 1: normal
    assert_eq!(rows[0].get("Name").map(String::as_str), Some("AppNormal"));
    assert_eq!(rows[0].get("Id").map(String::as_str), Some("Normal.App"));
    assert_eq!(rows[0].get("Version").map(String::as_str), Some("1.0.0"));

    // Row 2: fewer columns
    assert_eq!(rows[1].get("Name").map(String::as_str), Some("AppShort"));
    assert_eq!(rows[1].get("Id").map(String::as_str), Some(""));
    assert_eq!(rows[1].get("Version").map(String::as_str), Some(""));

    // Row 3: more columns (extra text absorbed into last column)
    assert_eq!(rows[2].get("Name").map(String::as_str), Some("AppExtra"));
    assert_eq!(rows[2].get("Id").map(String::as_str), Some("Extra.App"));
    assert!(rows[2].get("Version").unwrap().contains("2.0.0"));
    assert!(rows[2].get("Version").unwrap().contains("extra_source_info"));
}

#[test]
fn stress_decode_command_bytes_utf8_gbk_mixed_invalid() {
    // 1. Valid UTF-8 bytes (ASCII, multibyte CJK, emoji)
    let utf8_str = "Breeze 极速包管理器 🚀 v0.1.1";
    assert_eq!(decode_command_bytes(utf8_str.as_bytes()), utf8_str);

    // 2. Valid GBK bytes (Simplified Chinese Windows command prompt)
    let gbk_phrase = [
        0xD2, 0xD1, 0xD5, 0xD2, 0xB5, 0xBD, 0xD2, 0xBB,
        0xB8, 0xF6, 0xB3, 0xCC, 0xD0, 0xF2, 0xB0, 0xFC,
    ];
    let decoded_gbk = decode_command_bytes(&gbk_phrase);
    assert_eq!(decoded_gbk, "已找到一个程序包");

    // 3. Invalid / Truncated byte sequences:
    let truncated_utf8 = [0xE4, 0xBD];
    let res = decode_command_bytes(&truncated_utf8);
    assert!(!res.is_empty());

    let invalid_bytes = [0x80, 0x81, 0xFF, 0xFE];
    let res_invalid = decode_command_bytes(&invalid_bytes);
    assert!(!res_invalid.is_empty());

    // Empty buffer
    assert_eq!(decode_command_bytes(&[]), "");
}

#[test]
fn stress_progress_heuristics_percentage_variations() {
    // Standard percentage formats
    assert_eq!(extract_progress_from_line("25.5%"), Some(25.5));
    assert_eq!(extract_progress_from_line("0%"), Some(0.0));
    assert_eq!(extract_progress_from_line("100%"), Some(100.0));
    assert_eq!(extract_progress_from_line("0.0%"), Some(0.0));
    assert_eq!(extract_progress_from_line("100.0%"), Some(100.0));
    assert_eq!(extract_progress_from_line("Download: 45.2% [10MB/20MB]"), Some(45.2));
    assert_eq!(extract_progress_from_line("Multiple: 20% and 80%"), Some(20.0));

    // Out-of-bounds rejection
    assert_eq!(extract_progress_from_line("105%"), None);
    assert_eq!(extract_progress_from_line("100.1%"), None);
    assert_eq!(extract_progress_from_line("999%"), None);

    // Malformed percentage numbers
    assert_eq!(extract_progress_from_line(".%"), None);
    assert_eq!(extract_progress_from_line("abc%"), None);
}

#[test]
fn stress_progress_heuristics_block_patterns() {
    // Standard supported blocks (█ U+2588 and ▒ U+2592)
    assert_eq!(extract_progress_from_line("████▒▒▒▒▒▒"), Some(40.0));
    assert_eq!(extract_progress_from_line("██████████"), Some(100.0));
    assert_eq!(extract_progress_from_line("▒▒▒▒▒▒▒▒▒▒"), Some(0.0));
    assert_eq!(extract_progress_from_line("████████▒▒ [8/10]"), Some(80.0));

    // Empirical observation: Alternative shaded block elements (▓ U+2593, ░ U+2591)
    // are NOT supported by the heuristic and return None.
    assert_eq!(extract_progress_from_line("▓▓▓▓░░░░"), None);
    assert_eq!(extract_progress_from_line("▌▌▌▌      "), None);
}

#[test]
fn stress_progress_heuristics_lifecycle_keywords() {
    // Exact matched keywords
    assert_eq!(extract_progress_from_line("正在安装程序包..."), Some(100.0));
    assert_eq!(extract_progress_from_line("Installing Microsoft.PowerToys..."), Some(100.0));
    assert_eq!(extract_progress_from_line("Starting uninstall process..."), Some(100.0));
    assert_eq!(extract_progress_from_line("正在卸载程序..."), Some(100.0));

    // Empirical observation: Case-sensitive and phrasing variations that return None
    // "Starting package install..." contains lowercase "install", not "Installing"
    assert_eq!(extract_progress_from_line("Starting package install..."), None);
    // "Uninstalling" (TitleCase) does not match lowercase "uninstall"
    assert_eq!(extract_progress_from_line("Uninstalling package..."), None);
    // "Successfully installed" does not match "Installing"
    assert_eq!(extract_progress_from_line("Successfully installed"), None);
    // Intermediate non-keyword phase
    assert_eq!(extract_progress_from_line("Verifying package hash..."), None);
}

#[test]
fn stress_progress_heuristics_noise_and_ansi() {
    // Empty and whitespace
    assert_eq!(extract_progress_from_line(""), None);
    assert_eq!(extract_progress_from_line("   \t\r   "), None);
    assert_eq!(extract_progress_from_line("Random console log with 12345"), None);

    // ANSI escape sequences
    assert_eq!(extract_progress_from_line("\x1b[2K\x1b[0G   50.0%  \x1b[1m"), Some(50.0));
    assert_eq!(extract_progress_from_line("\x1b[32m25.5%\x1b[0m"), Some(25.5));
    assert_eq!(extract_progress_from_line("\x1b[1;34m████▒▒▒▒▒▒\x1b[0m"), Some(40.0));
    assert_eq!(extract_progress_from_line("\x1b[2K\x1b[1A"), None);
}

