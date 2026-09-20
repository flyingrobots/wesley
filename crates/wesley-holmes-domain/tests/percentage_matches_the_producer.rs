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
