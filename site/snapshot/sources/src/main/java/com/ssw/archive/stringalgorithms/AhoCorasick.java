package com.ssw.archive.stringalgorithms;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Aho–Corasick multi-pattern matcher for ASCII text (Wave3 semantics). */
/**
 * 여러 패턴을 하나의 트라이에 넣고 실패 링크를 따라가며 텍스트를 한 번에 검색하는 아호-코라식 알고리즘이다.
 * 각 상태는 접두사 전이와 가장 긴 올바른 접미사 상태를 가리키는 실패 링크를 유지해, 불일치가 나도 이미 읽은 문자를 되돌리지 않는다.
 * 겹치는 일치도 모두 보존하고 끝 위치, 시작 위치, 원래 패턴 입력 순서로 정렬해 동률 결과를 결정적으로 만든다.
 * 빈 패턴·중복 ID·비 ASCII 입력과 일치 개수 상한 초과는 계약 오류로 거부하며 입력 문자열과 패턴 배열은 변경하지 않는다.
 * 구축과 검색은 O(텍스트 길이 + 전체 패턴 길이)에 수행되고, 최종 일치 정렬에는 O(k log k), 저장 공간에는 O(전체 패턴 길이 + k)가 든다.
 */
public final class AhoCorasick {
    private AhoCorasick() { }

    public record Pattern(String id, String value) { }

    public record Match(String patternId, int start, int end) { }

    public static List<Match> execute(String text, List<Pattern> patterns) {
        Objects.requireNonNull(text, "text");
        Objects.requireNonNull(patterns, "patterns");
        if (!isAscii(text) || text.length() > 100_000 || patterns.size() > 10_000) {
            throw new IllegalArgumentException("input");
        }
        Set<String> ids = new HashSet<>();
        int totalLength = 0;
        IndexedPattern[] indexedPatterns = new IndexedPattern[patterns.size()];
        for (int patternIndex = 0; patternIndex < patterns.size(); patternIndex++) {
            Pattern pattern = patterns.get(patternIndex);
            Objects.requireNonNull(pattern, "pattern");
            Objects.requireNonNull(pattern.id, "id");
            Objects.requireNonNull(pattern.value, "value");
            if (pattern.id.isEmpty()
                    || pattern.value.isEmpty()
                    || !isAscii(pattern.id)
                    || !isAscii(pattern.value)
                    || !ids.add(pattern.id)) {
                throw new IllegalArgumentException("pattern");
            }
            totalLength += pattern.value.length();
            if (totalLength > 100_000) {
                throw new IllegalArgumentException("pattern-length");
            }
            indexedPatterns[patternIndex] = new IndexedPattern(pattern.id, pattern.value, patternIndex);
        }
        List<Node> nodes = new ArrayList<>();
        nodes.add(new Node());
        for (int patternIndex = 0; patternIndex < indexedPatterns.length; patternIndex++) {
            int state = 0;
            for (int charIndex = 0; charIndex < indexedPatterns[patternIndex].value.length(); charIndex++) {
                char character = indexedPatterns[patternIndex].value.charAt(charIndex);
                int child = nodes.get(state).transitions[character];
                if (child == -1) {
                    child = nodes.size();
                    nodes.get(state).transitions[character] = child;
                    nodes.add(new Node());
                }
                state = child;
            }
            nodes.get(state).addTerminal(patternIndex);
        }
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int character = 0; character < 128; character++) {
            int child = nodes.get(0).transitions[character];
            if (child == -1) {
                nodes.get(0).transitions[character] = 0;
            } else {
                queue.add(child);
            }
        }
        while (!queue.isEmpty()) {
            int state = queue.removeFirst();
            int failure = nodes.get(state).failure;
            for (int character = 0; character < 128; character++) {
                int child = nodes.get(state).transitions[character];
                if (child == -1) {
                    nodes.get(state).transitions[character] = nodes.get(failure).transitions[character];
                    continue;
                }
                queue.add(child);
                int fallback = nodes.get(failure).transitions[character];
                nodes.get(child).failure = fallback;
                nodes.get(child).outputLink = nodes.get(fallback).terminalPatternIndices != null
                        ? fallback
                        : nodes.get(fallback).outputLink;
            }
        }
        List<IndexedMatch> matches = new ArrayList<>();
        int currentState = 0;
        for (int index = 0; index < text.length(); index++) {
            currentState = nodes.get(currentState).transitions[text.charAt(index)];
            for (int outputState = currentState; outputState != -1; outputState = nodes.get(outputState).outputLink) {
                List<Integer> terminalPatternIndices = nodes.get(outputState).terminalPatternIndices;
                if (terminalPatternIndices == null) {
                    continue;
                }
                for (int patternIndex : terminalPatternIndices) {
                    IndexedPattern pattern = indexedPatterns[patternIndex];
                    matches.add(new IndexedMatch(
                            pattern.id,
                            index + 1 - pattern.value.length(),
                            index + 1,
                            pattern.inputIndex));
                    if (matches.size() > 100_000) {
                        throw new IllegalStateException("match-limit");
                    }
                }
            }
        }
        matches.sort((left, right) -> {
            int compared = Integer.compare(left.end, right.end);
            if (compared != 0) {
                return compared;
            }
            compared = Integer.compare(left.start, right.start);
            return compared != 0 ? compared : Integer.compare(left.inputIndex, right.inputIndex);
        });
        List<Match> output = new ArrayList<>(matches.size());
        for (IndexedMatch match : matches) {
            output.add(new Match(match.patternId, match.start, match.end));
        }
        return output;
    }

    private static boolean isAscii(String value) {
        for (int index = 0; index < value.length(); index++) {
            if (value.charAt(index) > 0x7f) {
                return false;
            }
        }
        return true;
    }

    private record IndexedPattern(String id, String value, int inputIndex) { }

    private record IndexedMatch(String patternId, int start, int end, int inputIndex) { }

    private static final class Node {
        private final int[] transitions = new int[128];
        private int failure;
        private int outputLink = -1;
        private List<Integer> terminalPatternIndices;

        private Node() {
            Arrays.fill(transitions, -1);
        }

        private void addTerminal(int patternIndex) {
            if (terminalPatternIndices == null) {
                terminalPatternIndices = new ArrayList<>();
            }
            terminalPatternIndices.add(patternIndex);
        }
    }
}
