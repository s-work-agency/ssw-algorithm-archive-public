namespace Ssw.Archive.StringAlgorithms;

/// <summary>Finds all ASCII pattern occurrences with an Aho–Corasick automaton.</summary>
/// <remarks>
/// Text is ASCII with length at most 100,000. At most 10,000 patterns are supported; IDs are unique nonempty ASCII
/// strings, patterns are nonempty ASCII strings, and total pattern length is at most 100,000. At most 100,000
/// matches may be emitted. Matches sort by exclusive end, start, then pattern input index. Terminal references stay
/// local to trie nodes and suffix outputs are followed through output links rather than copied onto failure nodes.
/// 여러 패턴을 하나의 트라이에 합치고 실패 링크를 따라가며 텍스트를 한 번 훑는 Aho-Corasick 원리를 사용해요.
/// 각 상태는 현재까지 일치한 가장 긴 접미사를 나타내며 출력 링크는 terminal 목록을 복제하지 않고 다음 일치 상태를 가리켜요.
/// 결과는 끝 위치, 시작 위치, 패턴 입력 순서로 정렬해 결정성을 보장하고 ASCII·크기·출력 한도 위반은 탐색 전에 거부해요.
/// 시간 복잡도는 O(텍스트 길이 + 전체 패턴 길이 + 결과 정렬), 공간 복잡도는 O(전체 패턴 길이 + 일치 수)예요.
/// </remarks>
public static class AhoCorasick {
    /// <summary>Associates one unique ID with one nonempty ASCII pattern.</summary>
    public sealed record Pattern(string Id, string Value);

    /// <summary>Reports a half-open text range for one pattern ID.</summary>
    public sealed record Match(string PatternId, int Start, int End);

    /// <summary>Builds the automaton and returns every canonical match.</summary>
    public static IReadOnlyList<Match> Execute(string text, IReadOnlyList<Pattern> patterns) {
        Validate(text, patterns);
        var indexedPatterns = patterns.Select((pattern, index) => new IndexedPattern(
            pattern.Id,
            pattern.Value,
            index)).ToArray();
        var nodes = new List<Node> { new() };
        for (var patternIndex = 0; patternIndex < indexedPatterns.Length; patternIndex++) {
            var state = 0;
            foreach (var character in indexedPatterns[patternIndex].Value) {
                var child = nodes[state].Transitions[character];
                if (child == -1) {
                    child = nodes.Count;
                    nodes[state].Transitions[character] = child;
                    nodes.Add(new Node());
                }
                state = child;
            }
            nodes[state].AddTerminal(patternIndex);
        }

        var queue = new Queue<int>();
        for (var character = 0; character < 128; character++) {
            var child = nodes[0].Transitions[character];
            if (child == -1) nodes[0].Transitions[character] = 0;
            else queue.Enqueue(child);
        }
        while (queue.TryDequeue(out var state)) {
            var failure = nodes[state].Failure;
            for (var character = 0; character < 128; character++) {
                var child = nodes[state].Transitions[character];
                if (child == -1) {
                    nodes[state].Transitions[character] = nodes[failure].Transitions[character];
                    continue;
                }
                queue.Enqueue(child);
                var fallback = nodes[failure].Transitions[character];
                nodes[child].Failure = fallback;
                nodes[child].OutputLink = nodes[fallback].TerminalPatternIndices is not null
                    ? fallback
                    : nodes[fallback].OutputLink;
            }
        }

        var matches = new List<IndexedMatch>();
        var currentState = 0;
        for (var index = 0; index < text.Length; index++) {
            currentState = nodes[currentState].Transitions[text[index]];
            for (var outputState = currentState; outputState != -1; outputState = nodes[outputState].OutputLink) {
                var terminalPatternIndices = nodes[outputState].TerminalPatternIndices;
                if (terminalPatternIndices is null) continue;
                foreach (var patternIndex in terminalPatternIndices) {
                    var pattern = indexedPatterns[patternIndex];
                    matches.Add(new IndexedMatch(
                        pattern.Id,
                        index + 1 - pattern.Value.Length,
                        index + 1,
                        pattern.InputIndex));
                    if (matches.Count > 100_000) throw new InvalidOperationException("The match limit was exceeded.");
                }
            }
        }
        matches.Sort((left, right) => {
            var compared = left.End.CompareTo(right.End);
            if (compared != 0) return compared;
            compared = left.Start.CompareTo(right.Start);
            return compared != 0 ? compared : left.InputIndex.CompareTo(right.InputIndex);
        });
        return matches.Select(match => new Match(match.PatternId, match.Start, match.End)).ToArray();
    }

    /// <summary>텍스트와 패턴의 ASCII·개수·길이·ID 유일성 계약을 검사해 잘못된 입력은 자동자 구축 전에 거부해요.</summary>
    /// <remarks>패턴 입력 순서를 유지하며 ID 집합과 전체 패턴 길이를 누적하고, 첫 위반에서 예외를 던져요. 시간은 O(|text| + 전체 패턴 길이), 추가 공간은 ID 집합 O(패턴 수)이며 반환값은 없어요.</remarks>
    private static void Validate(string text, IReadOnlyList<Pattern> patterns) {
        ArgumentNullException.ThrowIfNull(text);
        ArgumentNullException.ThrowIfNull(patterns);
        if (!IsAscii(text)) throw new ArgumentException("Text must be ASCII.", nameof(text));
        if (text.Length > 100_000 || patterns.Count > 10_000) throw new ArgumentOutOfRangeException(nameof(patterns));
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var totalLength = 0;
        foreach (var pattern in patterns) {
            ArgumentNullException.ThrowIfNull(pattern);
            if (string.IsNullOrEmpty(pattern.Id) || string.IsNullOrEmpty(pattern.Value) ||
                !IsAscii(pattern.Id) || !IsAscii(pattern.Value) || !ids.Add(pattern.Id)) {
                throw new ArgumentException("Patterns require unique nonempty ASCII IDs and values.", nameof(patterns));
            }
            totalLength += pattern.Value.Length;
            if (totalLength > 100_000) throw new ArgumentOutOfRangeException(nameof(patterns));
        }
    }

    /// <summary>문자열의 모든 UTF-16 코드 단위가 ASCII 범위인지 순서대로 확인해요.</summary>
    /// <remarks>첫 비ASCII 문자에서 false를 반환하고 전부 통과하면 true를 반환해요. 시간은 O(|value|), 추가 공간은 O(1)이에요.</remarks>
    private static bool IsAscii(string value) => value.All(character => character <= 0x7f);

    private sealed record IndexedPattern(string Id, string Value, int InputIndex);
    private sealed record IndexedMatch(string PatternId, int Start, int End, int InputIndex);

    private sealed class Node {
        /// <summary>새 자동자 상태의 128개 ASCII 전이를 모두 미정 값 -1로 초기화해요.</summary>
        /// <remarks>failure 기본값 0과 output link -1 불변식을 유지하며 반환값은 없어요. 시간과 상태별 전이 공간은 고정 알파벳 크기 O(128), 즉 O(1)이에요.</remarks>
        internal Node() => Array.Fill(Transitions, -1);
        internal int[] Transitions { get; } = new int[128];
        internal int Failure { get; set; }
        internal int OutputLink { get; set; } = -1;
        internal List<int>? TerminalPatternIndices { get; private set; }
        /// <summary>현재 trie 상태에서 끝나는 패턴의 입력 인덱스를 terminal 목록에 추가해요.</summary>
        /// <remarks>목록은 최초 terminal에서만 만들고 입력 순서를 보존해 동률 정렬 근거를 유지해요. 반환값은 없고 분할상환 시간 O(1), 추가 공간 O(1)이에요.</remarks>
        internal void AddTerminal(int patternIndex) => (TerminalPatternIndices ??= []).Add(patternIndex);
    }
}
