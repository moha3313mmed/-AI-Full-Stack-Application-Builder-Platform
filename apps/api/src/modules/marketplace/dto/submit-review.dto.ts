import { IsInt, IsString, Max, Min } from 'class-validator';

export class SubmitReviewDto {
  @IsString()
  // TODO: Once authentication is implemented, userId should be derived from
  // the authenticated session rather than accepted from the request body.
  // Accepting it from the body allows callers to impersonate other users.
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  title!: string;

  @IsString()
  content!: string;
}
