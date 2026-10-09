const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata",
});

export function mockCreatedDate(createdAt: string): string {
  const parts = dateFormatter.formatToParts(new Date(createdAt));
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

export function matchesMockFilter(mock: { title: string; createdDate: string }, title: string, date: string): boolean {
  return mock.title.toLowerCase().includes(title.trim().toLowerCase()) && (!date || mock.createdDate === date);
}
