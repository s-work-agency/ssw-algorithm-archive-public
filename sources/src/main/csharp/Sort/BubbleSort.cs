using System;

namespace Ssw.Archive.Sort;

/// <summary>Stable, non-mutating bubble-sort reference implementation.</summary>
/// <remarks>
/// Values is non-null and every element is a signed 32-bit integer. The result is ascending, duplicates are
/// retained, equal values preserve relative order, and the input array is never modified. Empty input is valid.
/// 인접한 역전 쌍만 교환해 매 pass마다 아직 정렬되지 않은 구간의 최댓값을 오른쪽 끝으로 보내요.
/// 완료된 suffix는 이미 최종 위치에 있고 strict greater-than 비교로 같은 값의 상대 순서를 유지해요.
/// 입력을 복제한 배열만 바꾸며 교환이 없는 pass에서 종료하므로 결과와 조기 종료가 결정적이에요.
/// 최악 시간 복잡도는 O(n²), 출력 배열을 제외한 추가 공간 복잡도는 O(1)이에요.
/// 정적 경계 자체는 상태나 값을 반환하지 않고 <c>Sort</c>가 새 배열 또는 null 오류를 제공해요.
/// </remarks>
public static class BubbleSort {
    /// <summary>입력을 복제한 배열에서 인접 역전만 교환하고 swap 없는 pass에서 조기 종료해요.</summary>
    /// <remarks>배열과 swapped flag를 사용하고 같은 값은 교환하지 않아 tie를 입력 순서로 고정하며 null은 ArgumentNullException, 입력은 불변이에요. 새 오름차순 배열을 반환하고 시간 O(n²), 출력 외 공간 O(1)이에요.</remarks>
    public static int[] Sort(int[] values) {
        ArgumentNullException.ThrowIfNull(values);
        var output = (int[])values.Clone();
        for (var end = output.Length - 1; end > 0; end--) {
            var swapped = false;
            for (var index = 0; index < end; index++) {
                if (output[index] > output[index + 1]) {
                    (output[index], output[index + 1]) = (output[index + 1], output[index]);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
        return output;
    }
}
