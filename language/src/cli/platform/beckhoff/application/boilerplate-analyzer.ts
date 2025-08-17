/**
 * Analyzes generated code to determine if time-related boilerplate variables are needed
 */
export class BoilerplateAnalyzer {
  private static readonly TIME_VARIABLES = [
    "fbLocalTime",
    "timeNow",
    "todNow",
    "dNow",
  ];

  public static isTimeBoilerplateNeeded(generatedContent: string): boolean {
    return this.TIME_VARIABLES.some((variable) =>
      generatedContent.includes(variable)
    );
  }

  public static getTimeInitializationCode(): string {
    return [
      "fbLocalTime();",
      "timeNow := fbLocalTime.systemTime;",
      "todNow := SYSTEMTIME_TO_TOD(timeNow);",
      "dNow := DT_TO_DATE(SYSTEMTIME_TO_DT(timeNow));",
    ].join("\n");
  }

  public static getTimeBoilerplateDeclarations(): string {
    return `
    fbLocalTime: FB_LocalSystemTime := (
      sNetID := '',
      bEnable := TRUE,
      dwCycle := 5
    );
    timeNow: TIMESTRUCT;
    todNow: TIME_OF_DAY;
    dNow: DATE;`;
  }
}
