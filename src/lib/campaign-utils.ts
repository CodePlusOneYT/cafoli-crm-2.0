export const getDefaultBlockData = (type: string): any => {
  switch (type) {
    case "wait":
      return { duration: 1, unit: "hours" };
    case "send_email":
      return { subject: "", content: "", trackOpens: true, trackClicks: true };
    case "send_whatsapp":
      return { templateId: "", templateName: "" };
    case "conditional":
      return { condition: "email_opened", timeLimit: 24, timeLimitUnit: "hours", truePath: [], falsePath: [] };
    case "ab_test":
      return { splitPercentage: 50, pathA: [], pathB: [] };
    case "add_tag":
      return { tagId: "" };
    case "remove_tag":
      return { tagId: "" };
    case "lead_condition":
      return { condition: "has_tags", tagIds: [], timeValue: 1, timeUnit: "days", truePath: [], falsePath: [] };
    default:
      return {};
  }
};
