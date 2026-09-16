import { notFound } from "next/navigation";

export default async function DevUiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { UiGallery } = await import("./ui-gallery");
  return <UiGallery />;
}
