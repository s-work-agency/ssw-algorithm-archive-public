package com.ssw.archive.sort;

/** Stable, non-mutating bubble-sort reference implementation. */
/**
 * 인접한 두 값을 반복 비교해 큰 값을 배열 오른쪽으로 밀어내는 버블 정렬이다.
 * 한 패스가 끝날 때마다 아직 확정되지 않은 구간의 최댓값이 그 구간 끝에 놓인다는 불변식을 사용한다.
 * 왼쪽부터 오른쪽으로 고정된 순서로 비교하고 같은 값은 교환하지 않아 상대 순서를 보존하는 안정 정렬이 된다.
 * 입력이 null인지 확인한 뒤 별도 결과 배열에서 작업해 호출자가 제공한 값 배열을 변경하지 않는다.
 * 최악 시간 복잡도는 O(n^2), 정렬 작업의 추가 공간 복잡도는 O(1)이다.
 */
public final class BubbleSort {
    private BubbleSort() { }

    /** Returns a new ascending array and leaves the input untouched. */
    public static int[] sort(int[] values) {
        if (values == null) {
            throw new IllegalArgumentException("values must not be null");
        }
        int[] sorted = values.clone();
        for (int upper = sorted.length - 1; upper > 0; upper--) {
            boolean swapped = false;
            for (int index = 0; index < upper; index++) {
                if (sorted[index] > sorted[index + 1]) {
                    int value = sorted[index];
                    sorted[index] = sorted[index + 1];
                    sorted[index + 1] = value;
                    swapped = true;
                }
            }
            if (!swapped) {
                break;
            }
        }
        return sorted;
    }
}
