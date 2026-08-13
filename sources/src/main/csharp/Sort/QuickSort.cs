using System;
using System.Collections.Generic;
using System.Linq;

namespace Ssw.Archive.Sort;

/// <summary>Non-mutating quick-sort reference implementation partitioned around the first value.</summary>
/// <remarks>
/// 첫 원소를 피벗으로 고정하고 더 작은 값, 같은 값, 더 큰 값으로 분할한 새 배열들을 결합합니다.
/// 각 분할 결과는 해당 부분 입력의 모든 원소를 정확히 한 번 보존하면서 오름차순이라는 불변식을 만족합니다.
/// 피벗 선택과 분할 순서가 고정되어 중복값도 결정적으로 처리되며 null 입력만 계산 전에 거부합니다.
/// 작은 분할만 재귀하고 큰 분할은 루프로 이어받아 스택 깊이를 O(log n)으로 묶습니다.
/// 평균 시간 복잡도는 O(n log n), 최악은 O(n²)이고 배열 복사에 최악 O(n²) 추가 공간을 사용할 수 있습니다.
/// Values is non-null and every element is a signed 32-bit integer. The result is ascending, duplicates are
/// retained, and the input array is unchanged. The first value is the pivot, the smaller side is the only
/// recursive call, and the larger side continues in the loop; empty input is valid.
/// 정적 경계 자체는 상태나 값을 반환하지 않고 <c>Sort</c>가 새 배열 또는 null 오류를 제공해요.
/// </remarks>
public static class QuickSort {
    /// <summary>첫 값을 pivot으로 less·equal·greater 배열에 안정 분할하고 작은 쪽만 재귀, 큰 쪽은 loop로 처리해요.</summary>
    /// <remarks>head·tail segment Lists로 결합 순서를 보존하고 같은 값 tie는 equal의 입력 순서로 고정하며 null은 ArgumentNullException이고 입력은 불변이에요. 새 오름차순 배열을 반환하고 평균 O(n log n), 최악 O(n²) 시간·복사 공간, stack O(log n)이에요.</remarks>
    public static int[] Sort(int[] values) {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Length < 2) return (int[])values.Clone();
        // 정렬된 입력에서도 스택이 터지지 않도록 작은 분할만 재귀하고 큰 분할은 이 루프가 이어받아요.
        // head는 current 앞에 붙을 구간, tail은 뒤에 붙을 구간을 역순으로 모아요.
        var head = new List<int[]>();
        var tail = new List<int[]>();
        var current = values;
        while (current.Length >= 2) {
            var pivot = current[0];
            var less = current.Where(value => value < pivot).ToArray();
            var equal = current.Where(value => value == pivot).ToArray();
            var greater = current.Where(value => value > pivot).ToArray();
            if (less.Length <= greater.Length) {
                head.Add(Sort(less));
                head.Add(equal);
                current = greater;
            } else {
                tail.Add(Sort(greater));
                tail.Add(equal);
                current = less;
            }
        }
        var result = new int[values.Length];
        var offset = 0;
        foreach (var segment in head) {
            segment.CopyTo(result, offset);
            offset += segment.Length;
        }
        current.CopyTo(result, offset);
        offset += current.Length;
        for (var index = tail.Count - 1; index >= 0; index--) {
            tail[index].CopyTo(result, offset);
            offset += tail[index].Length;
        }
        return result;
    }
}
