import { redirect } from 'next/navigation';

export default function ReviewsIndexPage() {
  redirect('/dashboard/reviews/my-tasks');
}
