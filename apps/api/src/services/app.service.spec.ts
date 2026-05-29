import { AppService } from "../app.service";

describe("AppService", () => {
  it("returns system metadata for the frontend bootstrap", () => {
    const service = new AppService();

    expect(service.getSystemStatus()).toEqual(
      expect.objectContaining({
        product: "AITRPG",
        authMode: "email-code",
        roomSurface: "text-live",
      }),
    );
  });
});

