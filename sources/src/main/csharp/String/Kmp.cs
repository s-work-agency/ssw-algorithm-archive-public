namespace Ssw.Archive.StringAlgorithms;

/// <summary>Finds all exact pattern occurrences with Knuth-Morris-Pratt prefix fallback.</summary>
/// <remarks>
/// Text and pattern contain only Basic Multilingual Plane code units (no UTF-16 surrogates), and pattern is
/// nonempty. Returned zero-based character offsets include overlapping matches and preserve ascending order.
/// Inputs are not mutated.
/// pattern의 proper prefix이면서 suffix인 최대 길이를 lps 표에 저장해 불일치 때 이미 맞은 구간을 재사용해요.
/// scan 중 matched 길이는 현재 text prefix의 suffix와 같은 pattern prefix의 최장 길이라는 불변식을 유지해요.
/// 모든 겹친 match를 오름차순으로 내며 빈 pattern·surrogate·null 오류는 탐색 전에 거부해요.
/// 시간 복잡도는 O(text 길이 + pattern 길이), lps 공간은 O(pattern 길이)예요.
/// </remarks>
public static class Kmp {
    /// <summary>Returns all zero-based start offsets of exact pattern matches.</summary>
    public static IReadOnlyList<int> Execute(string text, string pattern) {
        ArgumentNullException.ThrowIfNull(text);
        ArgumentNullException.ThrowIfNull(pattern);
        if (text.Any(char.IsSurrogate) || pattern.Any(char.IsSurrogate)) throw new ArgumentException("BMP text only.");
        if (pattern.Length == 0) throw new ArgumentException("Pattern must be nonempty.", nameof(pattern));
        var lps = new int[pattern.Length];
        var matched = 0;
        for (var index = 1; index < pattern.Length;) {
            if (pattern[index] == pattern[matched]) lps[index++] = ++matched;
            else if (matched > 0) matched = lps[matched - 1];
            else lps[index++] = 0;
        }
        var indices = new List<int>();
        var patternIndex = 0;
        for (var textIndex = 0; textIndex < text.Length;) {
            if (text[textIndex] == pattern[patternIndex]) {
                textIndex++;
                patternIndex++;
                if (patternIndex == pattern.Length) {
                    indices.Add(textIndex - patternIndex);
                    patternIndex = lps[patternIndex - 1];
                }
            } else if (patternIndex > 0) patternIndex = lps[patternIndex - 1];
            else textIndex++;
        }
        return indices;
    }
}
