using System;
using System.Linq;

namespace Ssw.Archive.Sort;

/// <summary>Non-mutating counting sort for signed integers with a bounded value range.</summary>
/// <remarks>
/// Values is non-null and every element is a signed 32-bit integer. For nonempty input, the counting span
/// max-min+1 is at most 1000000. The result is ascending, retains duplicates,
/// and leaves the input unchanged; empty input returns an empty array.
/// 계수 index 오름차순으로 동률을 고정하고 null·range 오류 뒤 새 배열만 반환하며 시간 O(n+r), 공간 O(r)이에요.
/// </remarks>
public static class CountingSort {
    /// <summary>계약이 허용하는 최대 계수 스팬 max - min + 1이에요.</summary>
    private const long MaximumSpan = 1_000_000L;

    /// <summary>
    /// long으로 min..max span을 계산한 count 배열을 채우고 index 순으로 중복 값을 펼쳐요.
    /// 동일 값 tie는 같은 계수 항으로 합치며 null은 ArgumentNullException, span 초과는 ArgumentException이고 입력은 불변이에요.
    /// 새 오름차순 배열을 반환하고 원소 n·span r에 시간 O(n+r), 공간 O(r+n)이에요.
    /// </summary>
    public static int[] Sort(int[] values) {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Length == 0) return [];
        var minimum = values.Min();
        // signed int 뺄셈을 먼저 하면 극단값에서 wrap되어 엉뚱한 배열 크기나 index가 돼요.
        // 따라서 범위를 long으로 계산하고 계약 상한(1,000,000) 안인지 먼저 확정해요.
        var range = (long)values.Max() - minimum + 1L;
        if (range > MaximumSpan) throw new ArgumentException("Value range is too large for counting sort.", nameof(values));
        var counts = new int[(int)range];
        foreach (var value in values) counts[(int)((long)value - minimum)]++;
        return counts.SelectMany((count, index) => Enumerable.Repeat(index + minimum, count)).ToArray();
    }
}
