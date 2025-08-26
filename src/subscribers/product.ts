import { EventBusService } from "@medusajs/medusa";

/**
 * Product Analytics Subscriber
 * Tracks product-related events for analytics
 */
class ProductSubscriber {
  protected eventBus_: EventBusService;
  protected googleAnalyticsService_: any;
  protected facebookService_: any;
  protected logger_: any;
  protected productVariantService_: any;
  protected cartService_: any;

  constructor({ eventBusService, googleAnalyticsService, facebookService, logger, productVariantService, cartService }: {
    eventBusService: any;
    googleAnalyticsService: any;
    facebookService: any;
    logger: any;
    productVariantService: any;
    cartService: any;
  }) {
    this.eventBus_ = eventBusService;
    this.googleAnalyticsService_ = googleAnalyticsService;
    this.facebookService_ = facebookService;
    this.logger_ = logger;
    this.productVariantService_ = productVariantService;
    this.cartService_ = cartService;

    // Subscribe to cart events
    this.eventBus_.subscribe("cart.item_added", (data: any) => this.handleItemAdded(data));
    this.eventBus_.subscribe("cart.item_removed", (data: any) => this.handleItemRemoved(data));
    this.eventBus_.subscribe("cart.item_updated", (data: any) => this.handleItemUpdated(data));
  }

  /**
   * Handle item added to cart
   */
  async handleItemAdded({ id, item }: { id: any; item: any }) {
    try {
      this.logger_.info(`Item added to cart: ${item.variant_id}`);
      
      const variant = await this.productVariantService_.retrieve(item.variant_id, {
        relations: ["product", "prices"],
      });
      
      const product = variant.product;
      
      // Track with Facebook
      if (this.facebookService_) {
        try {
          const userData = {
            // Extract from cart metadata if available
            clientIp: item.metadata?.clientIp,
            userAgent: item.metadata?.userAgent,
            fbc: item.metadata?.fbc,
            fbp: item.metadata?.fbp,
          };
          
          await this.facebookService_.trackAddToCart(product, variant, userData);
        } catch (error) {
          this.logger_.error('Failed to track Facebook add to cart:', error);
        }
      }
      
      // Track with Google Analytics
      if (this.googleAnalyticsService_) {
        try {
          const sessionData = {
            sessionId: item.metadata?.sessionId || item.metadata?.gaSessionId,
          };
          
          await this.googleAnalyticsService_.trackAddToCart(
            product,
            variant,
            item.quantity,
            item.metadata?.userId,
            sessionData
          );
        } catch (error) {
          this.logger_.error('Failed to track GA4 add to cart:', error);
        }
      }
    } catch (error) {
      this.logger_.error('Error handling item added event:', error);
    }
  }

  /**
   * Handle item removed from cart
   */
  async handleItemRemoved({ id, item }: { id: any; item: any }) {
    try {
      this.logger_.info(`Item removed from cart: ${item.variant_id}`);
      
      const variant = await this.productVariantService_.retrieve(item.variant_id, {
        relations: ["product", "prices"],
      });
      
      const product = variant.product;
      
      // Track with Google Analytics
      if (this.googleAnalyticsService_) {
        try {
          const sessionData = {
            sessionId: item.metadata?.sessionId || item.metadata?.gaSessionId,
          };
          
          await this.googleAnalyticsService_.trackRemoveFromCart(
            product,
            variant,
            item.quantity,
            item.metadata?.userId,
            sessionData
          );
        } catch (error) {
          this.logger_.error('Failed to track GA4 remove from cart:', error);
        }
      }
    } catch (error) {
      this.logger_.error('Error handling item removed event:', error);
    }
  }

  /**
   * Handle item updated in cart
   */
  async handleItemUpdated({ id, item, previousQuantity }: { id: any; item: any; previousQuantity: any }) {
    try {
      this.logger_.info(`Item updated in cart: ${item.variant_id}`);
      
      // Determine if quantity increased or decreased
      const quantityDifference = item.quantity - previousQuantity;
      
      if (quantityDifference > 0) {
        // Quantity increased - track as add to cart
        await this.handleItemAdded({ id, item: { ...item, quantity: quantityDifference } });
      } else if (quantityDifference < 0) {
        // Quantity decreased - track as remove from cart
        await this.handleItemRemoved({ id, item: { ...item, quantity: Math.abs(quantityDifference) } });
      }
    } catch (error) {
      this.logger_.error('Error handling item updated event:', error);
    }
  }
}

export default ProductSubscriber;
export const config = {
  imports: [
    "eventBusService",
    "googleAnalyticsService",
    "facebookService",
    "logger",
    "productVariantService",
    "cartService"
  ]
};
