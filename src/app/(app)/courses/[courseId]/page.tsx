import { CourseDetailClient } from "@/components/courses/course-detail-client";

export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export default function CourseDetailPage() {
  return <CourseDetailClient />;
}
