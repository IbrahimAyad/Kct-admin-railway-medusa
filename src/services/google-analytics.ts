import { BaseService } from "medusa-interfaces";
import { Logger } from "@medusajs/medusa";

/**
 * Google Analytics Integration Service
 * Handles GA4 server-side tracking and configuration
 */
class GoogleAnalyticsService extends BaseService {
  protected logger_: Logger;
  private clientId: string;
  private clientSecret: string;
  private projectId: string;
  private measurementId: string;
  private apiSecret: string;

  constructor({ logger }: { logger: Logger }, options?: any) {
    super();
    this.logger_ = logger;
    
    // Google Analytics configuration from environment
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.projectId = process.env.GOOGLE_PROJECT_ID || '';
    this.measurementId = 'G-LH26GTWFQS';
    this.apiSecret = process.env.GA4_API_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger_.warn("Google Analytics credentials not found. GA4 integration will be disabled.");
    }
  }

  /**
   * Track server-side GA4 event
   */
  async trackEvent(eventName: string, eventParams: any, userId?: string, sessionId?: string) {
    if (!this.measurementId || !this.apiSecret) {
      this.logger_.warn("GA4 Measurement ID or API Secret not configured. Skipping event tracking.");
      return;
    }

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
      
      const payload = {
        client_id: userId || this.generateClientId(),
        events: [{
          name: eventName,
          params: {
            session_id: sessionId || this.generateSessionId(),
            engagement_time_msec: 100,
            ...eventParams,
          },
        }],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 API error: ${errorText}`);
      }

      this.logger_.info(`GA4 event tracked: ${eventName}`);
      return true;
    } catch (error) {
      this.logger_.error('Failed to track GA4 event:', error);
      throw error;
    }
  }

  /**
   * Track purchase event for GA4 Enhanced Ecommerce
   */
  async trackPurchase(order: any, customer: any, sessionData?: any) {
    const eventParams = {
      currency: order.currency_code?.toUpperCase() || 'USD',
      transaction_id: order.id,
      value: order.total / 100, // Convert from cents
      affiliation: 'KCT Menswear Online Store',
      shipping: order.shipping_total / 100,
      tax: order.tax_total / 100,
      items: order.items?.map((item: any, index: number) => ({
        item_id: item.variant?.sku || item.variant?.id,
        item_name: item.title,
        affiliation: 'KCT Menswear',
        category: item.variant?.product?.type || 'Menswear',
        quantity: item.quantity,
        price: item.unit_price / 100,
        index: index,
      })) || [],
    };

    return this.trackEvent('purchase', eventParams, customer?.id, sessionData?.sessionId);
  }

  /**
   * Track add to cart event
   */
  async trackAddToCart(product: any, variant: any, quantity: number = 1, userId?: string, sessionData?: any) {
    const eventParams = {
      currency: 'USD',
      value: (variant.prices?.[0]?.amount / 100 || 0) * quantity,
      items: [{
        item_id: variant.sku || variant.id,
        item_name: product.title,
        affiliation: 'KCT Menswear',
        category: product.type || 'Menswear',
        quantity: quantity,
        price: variant.prices?.[0]?.amount / 100 || 0,
      }],
    };

    return this.trackEvent('add_to_cart', eventParams, userId, sessionData?.sessionId);
  }

  /**
   * Track remove from cart event
   */
  async trackRemoveFromCart(product: any, variant: any, quantity: number = 1, userId?: string, sessionData?: any) {
    const eventParams = {
      currency: 'USD',
      value: (variant.prices?.[0]?.amount / 100 || 0) * quantity,
      items: [{
        item_id: variant.sku || variant.id,
        item_name: product.title,
        affiliation: 'KCT Menswear',
        category: product.type || 'Menswear',
        quantity: quantity,
        price: variant.prices?.[0]?.amount / 100 || 0,
      }],
    };

    return this.trackEvent('remove_from_cart', eventParams, userId, sessionData?.sessionId);
  }

  /**
   * Track view item event
   */
  async trackViewItem(product: any, variant: any, userId?: string, sessionData?: any) {
    const eventParams = {
      currency: 'USD',
      value: variant?.prices?.[0]?.amount / 100 || 0,
      items: [{
        item_id: variant?.sku || variant?.id || product.id,
        item_name: product.title,
        affiliation: 'KCT Menswear',
        category: product.type || 'Menswear',
        price: variant?.prices?.[0]?.amount / 100 || 0,
      }],
    };

    return this.trackEvent('view_item', eventParams, userId, sessionData?.sessionId);
  }

  /**
   * Track begin checkout event
   */
  async trackBeginCheckout(cart: any, userId?: string, sessionData?: any) {
    const eventParams = {
      currency: cart.region?.currency_code?.toUpperCase() || 'USD',
      value: cart.total / 100,
      items: cart.items?.map((item: any, index: number) => ({
        item_id: item.variant?.sku || item.variant?.id,
        item_name: item.title,
        affiliation: 'KCT Menswear',
        category: item.variant?.product?.type || 'Menswear',
        quantity: item.quantity,
        price: item.unit_price / 100,
        index: index,
      })) || [],
    };

    return this.trackEvent('begin_checkout', eventParams, userId, sessionData?.sessionId);
  }

  /**
   * Track search event
   */
  async trackSearch(searchTerm: string, userId?: string, sessionData?: any) {
    const eventParams = {
      search_term: searchTerm,
    };

    return this.trackEvent('search', eventParams, userId, sessionData?.sessionId);
  }

  /**
   * Generate client ID for GA4
   */
  private generateClientId(): string {
    return `${Date.now()}.${Math.floor(Math.random() * 1000000000)}`;
  }

  /**
   * Generate session ID for GA4
   */
  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get GA4 configuration for frontend
   */
  getGA4Config() {
    return {
      measurementId: this.measurementId,
      enabled: !!(this.measurementId && this.clientId),
      projectId: this.projectId,
    };
  }
}

export default GoogleAnalyticsService;