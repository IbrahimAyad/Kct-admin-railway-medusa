import { BaseService } from "medusa-interfaces";
import { Logger } from "@medusajs/medusa";

/**
 * Facebook Business Integration Service
 * Handles Facebook Pixel tracking and Conversions API
 */
class FacebookService extends BaseService {
  protected logger_: Logger;
  private appId: string;
  private appSecret: string;
  private businessPortfolioId: string;
  private adAccountId: string;
  private pixelId: string;
  private datasetId: string;
  private apiVersion: string;
  private accessToken: string;

  constructor({ logger }: { logger: Logger }, options?: any) {
    super();
    this.logger_ = logger;
    
    // Facebook configuration from environment
    this.appId = process.env.FACEBOOK_APP_ID || '';
    this.appSecret = process.env.FACEBOOK_APP_SECRET || '';
    this.businessPortfolioId = process.env.FACEBOOK_BUSINESS_PORTFOLIO_ID || '';
    this.adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID || '';
    this.pixelId = process.env.FACEBOOK_PIXEL_ID || '';
    this.datasetId = process.env.FACEBOOK_DATASET_ID || '';
    this.apiVersion = process.env.FACEBOOK_API_VERSION || 'v22.0';

    if (!this.appId || !this.appSecret) {
      this.logger_.warn("Facebook credentials not found. Facebook integration will be disabled.");
    }
  }

  /**
   * Generate access token for server-side API calls
   */
  private generateAccessToken(): string {
    if (!this.accessToken) {
      this.accessToken = `${this.appId}|${this.appSecret}`;
    }
    return this.accessToken;
  }

  /**
   * Track server-side conversion event
   */
  async trackConversion(eventName: string, eventData: any, userData: any) {
    if (!this.pixelId || !this.datasetId) {
      this.logger_.warn("Facebook Pixel not configured. Skipping conversion tracking.");
      return;
    }

    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events`;
      
      const payload = {
        data: [{
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: 'https://kctmenswear.com',
          user_data: {
            em: userData.email ? this.hashData(userData.email.toLowerCase()) : undefined,
            ph: userData.phone ? this.hashData(userData.phone) : undefined,
            fn: userData.firstName ? this.hashData(userData.firstName.toLowerCase()) : undefined,
            ln: userData.lastName ? this.hashData(userData.lastName.toLowerCase()) : undefined,
            ct: userData.city ? this.hashData(userData.city.toLowerCase()) : undefined,
            st: userData.state ? this.hashData(userData.state.toLowerCase()) : undefined,
            zp: userData.zip ? this.hashData(userData.zip) : undefined,
            country: userData.country ? this.hashData(userData.country.toLowerCase()) : undefined,
            client_ip_address: userData.clientIp,
            client_user_agent: userData.userAgent,
            fbc: userData.fbc, // Facebook click ID
            fbp: userData.fbp, // Facebook browser ID
          },
          custom_data: {
            currency: eventData.currency || 'USD',
            value: eventData.value || 0,
            content_type: eventData.contentType || 'product',
            content_ids: eventData.contentIds || [],
            contents: eventData.contents || [],
            num_items: eventData.numItems || 1,
            order_id: eventData.orderId,
          },
        }],
        access_token: this.generateAccessToken(),
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
        throw new Error(`Facebook API error: ${errorText}`);
      }

      const result = await response.json();
      this.logger_.info(`Facebook conversion tracked: ${eventName}`);
      return result;
    } catch (error) {
      this.logger_.error('Failed to track Facebook conversion:', error);
      throw error;
    }
  }

  /**
   * Track purchase conversion
   */
  async trackPurchase(order: any, customer: any, userData: any) {
    const eventData = {
      currency: order.currency_code?.toUpperCase() || 'USD',
      value: order.total / 100, // Convert from cents
      contentType: 'product',
      contentIds: order.items?.map((item: any) => item.variant?.sku || item.variant?.id) || [],
      contents: order.items?.map((item: any) => ({
        id: item.variant?.sku || item.variant?.id,
        quantity: item.quantity,
        item_price: item.unit_price / 100,
      })) || [],
      numItems: order.items?.reduce((total: number, item: any) => total + item.quantity, 0) || 1,
      orderId: order.id,
    };

    const customerData = {
      email: customer?.email,
      phone: customer?.phone,
      firstName: customer?.first_name,
      lastName: customer?.last_name,
      city: order.shipping_address?.city,
      state: order.shipping_address?.province,
      zip: order.shipping_address?.postal_code,
      country: order.shipping_address?.country_code,
      ...userData,
    };

    return this.trackConversion('Purchase', eventData, customerData);
  }

  /**
   * Track add to cart conversion
   */
  async trackAddToCart(product: any, variant: any, userData: any) {
    const eventData = {
      currency: 'USD',
      value: variant.prices?.[0]?.amount / 100 || 0,
      contentType: 'product',
      contentIds: [variant.sku || variant.id],
      contents: [{
        id: variant.sku || variant.id,
        quantity: 1,
        item_price: variant.prices?.[0]?.amount / 100 || 0,
      }],
      numItems: 1,
    };

    return this.trackConversion('AddToCart', eventData, userData);
  }

  /**
   * Track view content (product page view)
   */
  async trackViewContent(product: any, variant: any, userData: any) {
    const eventData = {
      currency: 'USD',
      value: variant?.prices?.[0]?.amount / 100 || 0,
      contentType: 'product',
      contentIds: [product.id],
      contents: [{
        id: product.id,
        quantity: 1,
        item_price: variant?.prices?.[0]?.amount / 100 || 0,
      }],
      numItems: 1,
    };

    return this.trackConversion('ViewContent', eventData, userData);
  }

  /**
   * Hash data for privacy (SHA-256)
   */
  private hashData(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get Facebook Pixel configuration for frontend
   */
  getFacebookPixelConfig() {
    return {
      pixelId: this.pixelId,
      enabled: !!(this.pixelId && this.appId),
    };
  }
}

export default FacebookService;