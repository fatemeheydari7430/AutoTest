# Known Issues (staging backend)

Findings discovered by the Car negative API suite (`tests/api/car-negative.spec.ts`).
No external issue tracker is used, so items are listed by title only (no invented IDs).

## Future date of birth is accepted

- Endpoint: `PUT /motor/lead/manual/driver-information`
- Input: `date_of_birth = "2099-01-01"` (future) with a valid `country_id`
- Actual behavior: `200`, `successful: true`
- Expected behavior: rejected (`4xx`, `successful: false`)
- Status: known / open
- Test: `N6` (marked `test.fail` — will report "unexpected pass" once fixed)

## Out-of-range claim-free year is accepted

- Endpoint: `PUT /motor/lead/manual/claim-free-year`
- Input: `claim_free_year = 99`
- Actual behavior: `200`, `successful: true`
- Expected behavior: rejected (`4xx`, `successful: false`)
- Status: known / open
- Test: `N8` (marked `test.fail` — will report "unexpected pass" once fixed)

## Potential unauthenticated motor lead flow (uncertain)

- Endpoints: `POST /motor/lead` and downstream lead endpoints (e.g. `PUT /motor/lead/registration/emirate`, `GET /motor/lead/fetch?`) when a valid `tracking_code` is supplied
- Input: requests sent without an `Authorization` header
- Actual behavior: `POST /motor/lead` → `201`; downstream with a valid `tracking_code` → `200`
- Expected behavior: unclear — anonymous lead creation may be intentional. Needs a product/security decision before asserting.
- Status: open / uncertain (documented only, not asserted as a failure)
- Test: `N1` (records the actual contract)

## Correctly rejected inputs (for reference)

These are handled correctly and asserted as normal passing tests:
`PUT .../manual/year` without/invalid `tracking_code` → `410`;
invalid year → `418`; invalid emirate → `400`; invalid driving experience → `400`;
invalid `quote_id` on `add-quote` → `418`.

---

# Health API findings (`tests/api/health-negative.spec.ts`)

## Potential unauthenticated health lead creation (uncertain)

- Endpoints: `POST /health/v1/lead` (and lead flow keyed by `x-health-tracking-code`)
- Input: request sent without an `Authorization` header
- Actual behavior: `200`, `successful: true`, returns a `tracking_code` (`next_step: USER_DATA_ENTRY`)
- Expected behavior: unclear — anonymous lead creation may be intentional. Needs a product/security decision before asserting.
- Status: open / uncertain (documented only, not asserted as a failure)
- Test: `H1` (records the actual contract)

## Correctly rejected inputs (Health, for reference)

- `PUT .../lead/gender` without tracking code → `410`; with invalid tracking code → `404`
- invalid `gender` → `400` (RFC 7807 problem+json: "Failed to read request")
- invalid `emirate_key` → `400` (service envelope)
- invalid `salary_range` → `400` (RFC 7807)
- invalid member payload → `400` (RFC 7807)
- future `date_of_birth` → `400` (service envelope: "Date of birth cannot be today or in the future")
- invalid `special-condition` payload → `400` (RFC 7807)
- invalid `copay_id` on `quote/select` → `410`

Note: Health correctly rejects a future DOB (unlike Car, see above).

