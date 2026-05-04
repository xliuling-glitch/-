import { ReviewHubShell } from '@/components/review-hub/ReviewHubShell';

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <ReviewHubShell>{children}</ReviewHubShell>;
}
