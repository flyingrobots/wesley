//! Holmes recomputes the coverage percentage Wesley reports and compares the
//! two, so they must agree to the bit. The producer, `wesley-cli`, rounds with
//! `f64::round`. This crate is `no_std` and cannot, so it rounds another way.
//!
//! Oracle: differential. The reference is the producer's expression, evaluated
//! here with `std`. `f64::from(u32)` gives the same value as the producer's
//! `usize as f64` for every count in range.
//!
//! Size: small. Pure computation, no I/O.

use wesley_holmes_domain::percentage;

fn producer(covered: u32, total: u32) -> f64 {
    ((f64::from(covered) / f64::from(total)) * 1000.0).round() / 10.0
}

fn domain(covered: u32, total: u32) -> Result<f64, std::num::TryFromIntError> {
    Ok(percentage(
        usize::try_from(covered)?,
        usize::try_from(total)?,
    ))
}

#[test]
fn every_percentage_equals_the_producers_to_the_bit() -> Result<(), std::num::TryFromIntError> {
    let mut compared: u32 = 0;
    for total in 1..=1500_u32 {
        for covered in 0..=total {
            let expected = producer(covered, total);
            let actual = domain(covered, total)?;
            assert_eq!(
                actual.to_bits(),
                expected.to_bits(),
                "{covered}/{total}: domain {actual}, producer {expected}"
            );
            compared += 1;
        }
    }
    // Every pair with total <= 1500: 1500 * 1503 / 2.
    assert_eq!(compared, 1_127_250);
    Ok(())
}

#[test]
fn an_empty_category_is_fully_covered() {
    assert_eq!(percentage(0, 0).to_bits(), 100.0_f64.to_bits());
}

// Counts far above `u32::MAX`, and above 2^53 where `f64` can no longer hold
// every integer. Oracle: specified, by arithmetic on exact powers of two.
//
// The first two cases put the covered count in the low 32 bits and the total in
// the high 32. They are the ones that catch a wrong scale on the high half:
// when both counts are in the high half, a wrong scale cancels out of the
// ratio, which is how an earlier version of this test let that mutant live.
#[cfg(target_pointer_width = "64")]
#[test]
fn counts_beyond_u32_and_beyond_exact_f64_integers_convert_correctly() {
    let two_pow = |exponent: u32| 1_usize << exponent;
    for (covered, total, expected) in [
        (two_pow(31), two_pow(33), 25.0_f64),
        (3 * two_pow(30), two_pow(32), 75.0),
        (two_pow(40), two_pow(41), 50.0),
        (two_pow(60), two_pow(60), 100.0),
        // 2^53 + 1 is not representable and rounds to 2^53, so the ratio is 1/2.
        (two_pow(53) + 1, two_pow(54), 50.0),
    ] {
        assert_eq!(
            percentage(covered, total).to_bits(),
            expected.to_bits(),
            "{covered}/{total}"
        );
    }
}
