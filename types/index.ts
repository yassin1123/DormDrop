/**
 * DormDrop domain types.
 *
 * These interfaces mirror the Supabase schema in
 * `supabase/migrations/0001_initial_schema.sql`. Column names match the
 * database exactly (snake_case) so rows can be used without remapping.
 */

// ---------------------------------------------------------------------------
// Enums (kept in sync with the Postgres enum types)
// ---------------------------------------------------------------------------

export type UserRole = "requester" | "runner" | "both";

export type ItemCategory =
  | "snacks"
  | "drinks"
  | "essentials"
  | "stationery"
  | "personal_care"
  | "other";

export type OrderStatus =
  | "awaiting_payment"
  | "pending"
  | "accepted"
  | "picking_up"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type PayoutStatus = "pending" | "paid";

export type NotificationType =
  | "order_accepted"
  | "order_picked_up"
  | "order_delivered"
  | "order_cancelled"
  | "new_review"
  | "new_order_nearby";

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: UserRole;
  delivery_zone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_online: boolean;
  is_admin: boolean;
  is_suspended: boolean;
  onboarding_completed: boolean;
  runner_rating: number | null;
  total_deliveries: number;
  total_earnings: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: ItemCategory;
  image_url: string | null;
  in_stock: boolean;
  /** Finite stock count. null = unlimited (always available). */
  stock_quantity: number | null;
  is_deleted: boolean;
  created_at: string;
}

export interface CollectionPoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  opening_hours: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  requester_id: string;
  runner_id: string | null;
  status: OrderStatus;
  delivery_zone: string;
  delivery_address: string;
  delivery_notes: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  collection_point_id: string | null;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  estimated_delivery_minutes: number | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  price_at_time: number;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  runner_id: string;
  order_id: string;
  amount: number;
  status: PayoutStatus;
  created_at: string;
}

export interface RunnerLocation {
  id: string;
  runner_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

/** A review joined with the reviewer's display info (for the runner's profile). */
export interface ReviewWithReviewer extends Review {
  reviewer: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

// ---------------------------------------------------------------------------
// Composite / joined shapes used by the UI and API layer
// ---------------------------------------------------------------------------

/** An order_items row joined with its catalogue item. */
export interface OrderItemWithItem extends OrderItem {
  item: Item;
}

/** A full order with line items and the people involved. */
export interface OrderWithDetails extends Order {
  order_items: OrderItemWithItem[];
  requester: Pick<Profile, "id" | "full_name" | "avatar_url" | "delivery_zone">;
  runner:
    | Pick<Profile, "id" | "full_name" | "avatar_url" | "runner_rating">
    | null;
}

/** A single line in a cart, before an order is created. */
export interface CartLine {
  item: Item;
  quantity: number;
}

/** Payload the client sends to create an order. */
export interface CreateOrderInput {
  delivery_zone: string;
  delivery_address: string;
  delivery_notes?: string | null;
  /** Geocoded coordinates of the address, when chosen via autocomplete. */
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  items: { item_id: string; quantity: number }[];
}

/** Computed price breakdown for a cart. */
export interface PriceBreakdown {
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
}
