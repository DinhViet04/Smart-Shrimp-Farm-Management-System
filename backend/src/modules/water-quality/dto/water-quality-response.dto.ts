/**
 * Response DTO returned by POST /api/water-quality on success.
 * Matches the 201 Created response shape defined in FE-23.
 */
export class WaterQualityResponseDto {
  /** UUID of the newly created record */
  id: string;

  /** Human-readable confirmation message */
  message: string;
}
