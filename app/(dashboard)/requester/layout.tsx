import { CartProvider } from "@/components/cart/CartProvider";
import { ReviewPromptModal } from "@/components/reviews/ReviewPromptModal";

/**
 * Wraps everything under /requester (browse, checkout, orders, order detail) in
 * the cart context so the basket is shared across the journey, and mounts the
 * "rate your last order" prompt.
 */
export default function RequesterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      <ReviewPromptModal />
    </CartProvider>
  );
}
