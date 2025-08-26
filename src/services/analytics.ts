import { BaseService } from "medusa-interfaces";
import { Logger } from "@medusajs/medusa";

/**
 * Enterprise Analytics Service
 * Tracks business metrics and provides insights
 */
class AnalyticsService extends BaseService {
  protected logger_: Logger;
  protected manager_: any;

  constructor({ manager, logger }: { manager: any; logger: Logger }) {
    super();
    this.manager_ = manager;
    this.logger_ = logger;
  }

  /**
   * Get sales analytics for dashboard
   */
  async getSalesAnalytics(period: string = '30d') {
    try {
      const manager = this.manager_;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get orders within date range
      const ordersQuery = `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as order_count,
          SUM(total) as total_revenue,
          AVG(total) as average_order_value
        FROM "order" 
        WHERE created_at >= $1 AND created_at <= $2
          AND status NOT IN ('canceled', 'draft')
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `;

      const dailyStats = await manager.query(ordersQuery, [startDate, endDate]);

      // Get top products
      const topProductsQuery = `
        SELECT 
          p.title,
          p.handle,
          SUM(li.quantity) as units_sold,
          SUM(li.total) as revenue
        FROM line_item li
        JOIN product_variant pv ON li.variant_id = pv.id
        JOIN product p ON pv.product_id = p.id
        JOIN "order" o ON li.order_id = o.id
        WHERE o.created_at >= $1 AND o.created_at <= $2
          AND o.status NOT IN ('canceled', 'draft')
        GROUP BY p.id, p.title, p.handle
        ORDER BY revenue DESC
        LIMIT 10
      `;

      const topProducts = await manager.query(topProductsQuery, [startDate, endDate]);

      // Get customer metrics
      const customerMetricsQuery = `
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          COUNT(CASE WHEN customer_id IN (
            SELECT customer_id FROM "order" 
            WHERE created_at < $1 AND customer_id IS NOT NULL
            GROUP BY customer_id
          ) THEN 1 END) as returning_customers
        FROM "order"
        WHERE created_at >= $1 AND created_at <= $2
          AND customer_id IS NOT NULL
          AND status NOT IN ('canceled', 'draft')
      `;

      const customerMetrics = await manager.query(customerMetricsQuery, [startDate, endDate]);

      // Calculate totals
      const totalRevenue = dailyStats.reduce((sum: number, day: any) => sum + parseFloat(day.total_revenue || 0), 0);
      const totalOrders = dailyStats.reduce((sum: number, day: any) => sum + parseInt(day.order_count || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        period,
        dateRange: { start: startDate, end: endDate },
        summary: {
          totalRevenue: Math.round(totalRevenue),
          totalOrders,
          averageOrderValue: Math.round(averageOrderValue),
          uniqueCustomers: parseInt(customerMetrics[0]?.unique_customers || 0),
          returningCustomers: parseInt(customerMetrics[0]?.returning_customers || 0),
        },
        dailyStats: dailyStats.map((day: any) => ({
          date: day.date,
          revenue: Math.round(parseFloat(day.total_revenue || 0)),
          orders: parseInt(day.order_count || 0),
          averageOrderValue: Math.round(parseFloat(day.average_order_value || 0)),
        })),
        topProducts: topProducts.map((product: any) => ({
          title: product.title,
          handle: product.handle,
          unitsSold: parseInt(product.units_sold || 0),
          revenue: Math.round(parseFloat(product.revenue || 0)),
        })),
      };
    } catch (error) {
      this.logger_.error('Failed to get sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics() {
    try {
      const manager = this.manager_;

      // Low stock alerts
      const lowStockQuery = `
        SELECT 
          p.title,
          p.handle,
          pv.title as variant_title,
          pv.sku,
          pv.inventory_quantity,
          CASE 
            WHEN p.tags LIKE '%popular%' THEN 20
            WHEN p.tags LIKE '%suits%' THEN 15
            ELSE 10
          END as threshold
        FROM product_variant pv
        JOIN product p ON pv.product_id = p.id
        WHERE pv.inventory_quantity <= (
          CASE 
            WHEN p.tags LIKE '%popular%' THEN 20
            WHEN p.tags LIKE '%suits%' THEN 15
            ELSE 10
          END
        )
        AND pv.manage_inventory = true
        ORDER BY pv.inventory_quantity ASC
      `;

      const lowStockItems = await manager.query(lowStockQuery);

      // Out of stock items
      const outOfStockQuery = `
        SELECT 
          p.title,
          p.handle,
          pv.title as variant_title,
          pv.sku
        FROM product_variant pv
        JOIN product p ON pv.product_id = p.id
        WHERE pv.inventory_quantity <= 0
          AND pv.manage_inventory = true
        ORDER BY p.title ASC
      `;

      const outOfStockItems = await manager.query(outOfStockQuery);

      // Inventory value
      const inventoryValueQuery = `
        SELECT 
          SUM(pv.inventory_quantity * COALESCE(prices.amount, 0) / 100) as total_value,
          COUNT(*) as total_variants,
          SUM(pv.inventory_quantity) as total_units
        FROM product_variant pv
        LEFT JOIN (
          SELECT variant_id, amount
          FROM money_amount
          WHERE currency_code = 'usd'
        ) prices ON pv.id = prices.variant_id
        WHERE pv.manage_inventory = true
      `;

      const inventoryValue = await manager.query(inventoryValueQuery);

      return {
        summary: {
          totalValue: Math.round(parseFloat(inventoryValue[0]?.total_value || 0)),
          totalVariants: parseInt(inventoryValue[0]?.total_variants || 0),
          totalUnits: parseInt(inventoryValue[0]?.total_units || 0),
          lowStockCount: lowStockItems.length,
          outOfStockCount: outOfStockItems.length,
        },
        lowStockItems: lowStockItems.map((item: any) => ({
          title: item.title,
          handle: item.handle,
          variantTitle: item.variant_title,
          sku: item.sku,
          currentStock: parseInt(item.inventory_quantity || 0),
          threshold: parseInt(item.threshold || 10),
        })),
        outOfStockItems: outOfStockItems.map((item: any) => ({
          title: item.title,
          handle: item.handle,
          variantTitle: item.variant_title,
          sku: item.sku,
        })),
      };
    } catch (error) {
      this.logger_.error('Failed to get inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(period: string = '30d') {
    try {
      const manager = this.manager_;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Customer acquisition
      const acquisitionQuery = `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as new_customers
        FROM customer
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
      `;

      const customerAcquisition = await manager.query(acquisitionQuery, [startDate, endDate]);

      // Top customers by revenue
      const topCustomersQuery = `
        SELECT 
          c.email,
          c.first_name,
          c.last_name,
          COUNT(o.id) as order_count,
          SUM(o.total) as total_spent,
          AVG(o.total) as average_order_value,
          MAX(o.created_at) as last_order_date
        FROM customer c
        JOIN "order" o ON c.id = o.customer_id
        WHERE o.created_at >= $1 AND o.created_at <= $2
          AND o.status NOT IN ('canceled', 'draft')
        GROUP BY c.id, c.email, c.first_name, c.last_name
        ORDER BY total_spent DESC
        LIMIT 10
      `;

      const topCustomers = await manager.query(topCustomersQuery, [startDate, endDate]);

      return {
        period,
        dateRange: { start: startDate, end: endDate },
        customerAcquisition: customerAcquisition.map((day: any) => ({
          date: day.date,
          newCustomers: parseInt(day.new_customers || 0),
        })),
        topCustomers: topCustomers.map((customer: any) => ({
          email: customer.email,
          name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          orderCount: parseInt(customer.order_count || 0),
          totalSpent: Math.round(parseFloat(customer.total_spent || 0)),
          averageOrderValue: Math.round(parseFloat(customer.average_order_value || 0)),
          lastOrderDate: customer.last_order_date,
        })),
      };
    } catch (error) {
      this.logger_.error('Failed to get customer analytics:', error);
      throw error;
    }
  }
}

export default AnalyticsService;