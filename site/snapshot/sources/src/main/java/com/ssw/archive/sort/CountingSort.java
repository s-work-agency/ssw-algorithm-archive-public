package com.ssw.archive.sort;

/** Non-mutating counting sort for signed integers with bounded input range. */
/**
 * 입력 정수의 최솟값부터 최댓값까지 빈도 배열을 만들고 값 순서대로 펼쳐 오름차순 결과를 생성한다.
 * 각 빈도 칸은 대응 값의 남은 출력 횟수를 뜻하며, 모든 빈도의 합은 언제나 입력 길이와 같다.
 * 값 구간을 작은 값부터 고정 순서로 순회하므로 중복을 포함한 동일 입력은 항상 같은 배열을 얻는다.
 * null 입력과 백만을 넘는 값 구간은 큰 메모리 할당 전에 거부하고, 결과는 새 배열이라 원본을 변경하지 않는다.
 * 입력 길이를 n, 값 구간 크기를 k라 할 때 시간 복잡도는 O(n + k), 공간 복잡도는 O(n + k)이다.
 */
public final class CountingSort {
    private static final int MAX_RANGE = 1_000_000;

    private CountingSort() { }

    /** Returns a new ascending array and leaves the input untouched. */
    public static int[] sort(int[] values) {
        if (values == null) {
            throw new IllegalArgumentException("values must not be null");
        }
        if (values.length == 0) {
            return new int[0];
        }
        int min = values[0];
        int max = values[0];
        for (int value : values) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        long range = (long) max - min + 1;
        if (range > MAX_RANGE) {
            throw new IllegalArgumentException("value range exceeds counting-sort limit");
        }
        int[] count = new int[(int) range];
        for (int value : values) {
            count[value - min]++;
        }
        int[] output = new int[values.length];
        int index = 0;
        for (int value = 0; value < count.length; value++) {
            while (count[value]-- > 0) {
                output[index++] = value + min;
            }
        }
        return output;
    }
}
