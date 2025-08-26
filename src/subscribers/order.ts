import { EventBusService } from "@medusajs/medusa";

/**
 * Order Analytics Subscriber
 * Tracks order events for analytics and third-party integrations
 */
class OrderSubscriber {
  protected eventBus_: EventBusService;
  protected facebookService_: any;
  protected googleAnalyticsService_: any;
  protected logger_: any;
  protected orderService_: any;
  protected customerService_: any;

  constructor({ eventBusService, facebookService, googleAnalyticsService, logger, orderService, customerService }: {
    eventBusService: any;
    facebookService: any;
    googleAnalyticsService: any;
    logger: any;
    orderService: any;
    customerService: any;
  }) {
    this.eventBus_ = eventBusService;
    this.facebookService_ = facebookService;
    this.googleAnalyticsService_ = googleAnalyticsService;
    this.logger_ = logger;
    this.orderService_ = orderService;
    this.customerService_ = customerService;

    // Subscribe to order events
    this.eventBus_.subscribe("order.placed", (data: any) => this.handleOrderPlaced(data));
    this.eventBus_.subscribe("order.payment_captured", (data: any) => this.handlePaymentCaptured(data));
    this.eventBus_.subscribe("order.completed", (data: any) => this.handleOrderCompleted(data));
    this.eventBus_.subscribe("order.canceled", (data: any) => this.handleOrderCanceled(data));
  }

  /**
   * Handle order placed event
   */
  async handleOrderPlaced({ id, customer_id, metadata }: { id: any; customer_id: any; metadata: any }) {
    try {
      this.logger_.info(`Order placed: ${id}`);
      
      // Get order details with relationships
      const order = await this.orderService_.retrieve(id, {
        relations: ["items", "items.variant", "items.variant.product", "shipping_address", "billing_address"],
      });
      
      let customer = null;
      if (customer_id) {
        customer = await this.customerService_.retrieve(customer_id);
      }
      
      // Extract user data from metadata or request context
      const userData = {
        clientIp: metadata?.clientIp,
        userAgent: metadata?.userAgent,
        fbc: metadata?.fbc,
        fbp: metadata?.fbp,
      };
      
      // Track with Facebook
      if (this.facebookService_) {
        try {
          await this.facebookService_.trackPurchase(order, customer, userData);
        } catch (error) {
          this.logger_.error('Failed to track Facebook purchase:', error);
        }
      }
      
      // Track with Google Analytics
      if (this.googleAnalyticsService_) {
        try {
          const sessionData = {
            sessionId: metadata?.sessionId || metadata?.gaSessionId,
          };
          await this.googleAnalyticsService_.trackPurchase(order, customer, sessionData);
        } catch (error) {
          this.logger_.error('Failed to track GA4 purchase:', error);
        }
      }
    } catch (error) {
      this.logger_.error('Error handling order placed event:', error);
    }
  }

  /**
   * Handle payment captured event
   */
  async handlePaymentCaptured({ id }: { id: any }) {
    try {
      this.logger_.info(`Payment captured for order: ${id}`);
      
      // Additional tracking can be added here
      // For example, conversion tracking for different payment methods
    } catch (error) {
      this.logger_.error('Error handling payment captured event:', error);
    }
  }

  /**
   * Handle order completed event
   */
  async handleOrderCompleted({ id }: { id: any }) {
    try {
      this.logger_.info(`Order completed: ${id}`);
      
      // Track fulfillment completion
      // This could trigger email sequences, loyalty points, etc.
    } catch (error) {
      this.logger_.error('Error handling order completed event:', error);
    }
  }

  /**
   * Handle order canceled event
   */
  async handleOrderCanceled({ id }: { id: any }) {
    try {
      this.logger_.info(`Order canceled: ${id}`);
      
      // Track cancellations for analytics
      // This could help identify issues in the checkout process
    } catch (error) {
      this.logger_.error('Error handling order canceled event:', error);
    }
  }
}

export default OrderSubscriber;
export const config = {
  imports: [
    "eventBusService",
    "facebookService", 
    "googleAnalyticsService",
    "logger",
    "orderService",
    "customerService"
  ]
};
