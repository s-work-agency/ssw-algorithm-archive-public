package com.ssw.archive.sort;

/** Non-mutating quick-sort reference implementation (last-element Lomuto pivot). */
/**
 * 각 구간의 마지막 원소를 피벗으로 삼아 작거나 같은 값을 왼쪽에 모은 뒤 양쪽 구간을 재귀 정렬한다.
 * Lomuto 분할 중 경계 왼쪽은 모두 피벗 이하이고 경계부터 현재 인덱스 전까지는 피벗보다 크다는 불변식을 유지한다.
 * 피벗 위치와 왼쪽부터의 순회가 고정되어 중복 값이 있어도 같은 입력은 항상 같은 오름차순 배열을 만든다.
 * 분할 뒤에는 짧은 쪽 구간만 재귀하고 긴 쪽은 같은 호출에서 루프로 이어받아 재귀 깊이를 로그로 묶는다.
 * null 입력은 복사 전에 거부하고 복제 배열만 교환하므로 호출자가 준 원본은 바뀌지 않는다.
 * 입력 길이를 n이라 하면 평균 시간은 O(n log n), 최악 시간은 O(n²), 재귀 스택은 O(log n)이다.
 */
public final class QuickSort {
    private QuickSort() { }

    /** Returns a new ascending array and leaves the input untouched. */
    public static int[] sort(int[] values) {
        if (values == null) {
            throw new IllegalArgumentException("values must not be null");
        }
        int[] output = values.clone();
        sortRange(output, 0, output.length - 1);
        return output;
    }

    private static void sortRange(int[] values, int low, int high) {
        // 분할 결과 중 짧은 쪽만 재귀하고 긴 쪽은 while 루프로 되돌려 최악 입력에서도 스택 깊이를 O(log n)으로 묶는다.
        while (low < high) {
            int boundary = partition(values, low, high);
            if (boundary - low < high - boundary) {
                sortRange(values, low, boundary - 1);
                low = boundary + 1;
            } else {
                sortRange(values, boundary + 1, high);
                high = boundary - 1;
            }
        }
    }

    private static int partition(int[] values, int low, int high) {
        int pivot = values[high];
        int boundary = low;
        for (int index = low; index < high; index++) {
            if (values[index] <= pivot) {
                int swap = values[boundary];
                values[boundary] = values[index];
                values[index] = swap;
                boundary++;
            }
        }
        int swap = values[boundary];
        values[boundary] = values[high];
        values[high] = swap;
        return boundary;
    }
}
