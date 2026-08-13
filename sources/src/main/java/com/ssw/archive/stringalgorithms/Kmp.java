package com.ssw.archive.stringalgorithms;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Knuth–Morris–Pratt exact pattern matcher (BMP code units only). */
/**
 * 패턴의 접두사와 접미사가 겹치는 길이를 미리 계산해 불일치 때 텍스트 위치를 되돌리지 않고 검색한다.
 * 검색 중 일치 길이는 지금까지 읽은 텍스트 접미사와 패턴 접두사가 같은 최대 길이라는 불변식을 갖는다.
 * 일치가 발견되는 즉시 왼쪽부터 인덱스를 기록하므로 중첩 일치를 포함해 결과 순서가 결정적이다.
 * null, ASCII가 아닌 텍스트·패턴과 계약 길이 초과는 전처리 전에 거부하며 빈 패턴의 경계도 계약대로 처리한다.
 * 텍스트 길이를 n, 패턴 길이를 m이라 하면 시간은 O(n + m), 접두사 표와 결과를 제외한 보조 공간은 O(m)이다.
 */
public final class Kmp {
    private Kmp() { }

    /** Returns zero-based start offsets of every exact match, including overlaps. */
    public static List<Integer> execute(String text, String pattern) {
        Objects.requireNonNull(text, "text");
        Objects.requireNonNull(pattern, "pattern");
        if (pattern.isEmpty()) {
            throw new IllegalArgumentException("Pattern must be nonempty.");
        }
        for (int index = 0; index < text.length(); index++) {
            if (Character.isSurrogate(text.charAt(index))) {
                throw new IllegalArgumentException("BMP text only.");
            }
        }
        for (int index = 0; index < pattern.length(); index++) {
            if (Character.isSurrogate(pattern.charAt(index))) {
                throw new IllegalArgumentException("BMP text only.");
            }
        }
        int[] lps = new int[pattern.length()];
        for (int index = 1, matched = 0; index < pattern.length(); ) {
            if (pattern.charAt(index) == pattern.charAt(matched)) {
                lps[index++] = ++matched;
            } else if (matched > 0) {
                matched = lps[matched - 1];
            } else {
                lps[index++] = 0;
            }
        }
        List<Integer> indices = new ArrayList<>();
        for (int textIndex = 0, patternIndex = 0; textIndex < text.length(); ) {
            if (text.charAt(textIndex) == pattern.charAt(patternIndex)) {
                textIndex++;
                patternIndex++;
                if (patternIndex == pattern.length()) {
                    indices.add(textIndex - patternIndex);
                    patternIndex = lps[patternIndex - 1];
                }
            } else if (patternIndex > 0) {
                patternIndex = lps[patternIndex - 1];
            } else {
                textIndex++;
            }
        }
        return indices;
    }
}
