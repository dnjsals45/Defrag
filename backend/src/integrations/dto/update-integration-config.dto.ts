import { IsObject } from "class-validator";

export class UpdateIntegrationConfigDto {
  @IsObject()
  config: Record<string, any>;
}
