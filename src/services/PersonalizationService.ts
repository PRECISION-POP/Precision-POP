// This service simulates backend personalization for customer-specific coupons
// In a real implementation, this would connect to a backend API

interface PurchaseHistoryItem {
  productId: string;
  productName: string;
  category: string;
  lastPurchased: string; // ISO date string
  purchaseFrequency: 'frequent' | 'occasional' | 'rare';
  quantity: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  loyaltyPoints: number;
  preferredStore: string;
  favoriteCategories: string[];
  purchaseHistory: PurchaseHistoryItem[];
  shoppingPatterns: {
    preferredDayOfWeek: string;
    preferredTimeOfDay: string;
    averageCartSize: number;
    averageSpendPerVisit: number;
    priceConsciousness: 'low' | 'medium' | 'high';
  };
  lastVisits: Array<{
    date: string;
    store: string;
    totalSpent: number;
  }>;
}

export interface PersonalizedCoupon {
  id: string;
  title: string;
  description: string;
  image: string;
  expiresAt: string;
  category?: string;
  value: number;
  reason: string; // Why this coupon was recommended
  priority: number; // Higher number means higher priority
  aiGenerated?: boolean; // Flag for AI-generated coupons
  conversionProbability?: number; // AI-predicted probability of use
}

class PersonalizationService {
  // In a real implementation, this would be a database or API call
  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    console.log(`Fetching profile for customer: ${customerId}`);
    
    // Simulated customer data
    return {
      id: customerId,
      name: "John Doe",
      loyaltyPoints: 1250,
      preferredStore: "H-E-B Central",
      favoriteCategories: ["Produce", "Snacks", "Beverages"],
      purchaseHistory: [
        {
          productId: "p123",
          productName: "Organic Bananas",
          category: "Produce",
          lastPurchased: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          purchaseFrequency: "frequent",
          quantity: 2
        },
        {
          productId: "p456",
          productName: "Stacy's Pita Chips",
          category: "Snacks",
          lastPurchased: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
          purchaseFrequency: "frequent",
          quantity: 1
        },
        {
          productId: "p789",
          productName: "Premium Coffee Beans",
          category: "Beverages",
          lastPurchased: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          purchaseFrequency: "frequent",
          quantity: 1
        },
        {
          productId: "p012",
          productName: "Sourdough Bread",
          category: "Bakery",
          lastPurchased: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
          purchaseFrequency: "occasional",
          quantity: 1
        }
      ],
      shoppingPatterns: {
        preferredDayOfWeek: "Sunday",
        preferredTimeOfDay: "morning",
        averageCartSize: 12,
        averageSpendPerVisit: 65.75,
        priceConsciousness: "medium"
      },
      lastVisits: [
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          store: "H-E-B Central",
          totalSpent: 72.45
        },
        {
          date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          store: "H-E-B North",
          totalSpent: 58.32
        },
        {
          date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          store: "H-E-B Central",
          totalSpent: 64.18
        }
      ]
    };
  }

  async getPersonalizedCoupons(customerId: string): Promise<PersonalizedCoupon[]> {
    try {
      // Get customer profile (in a real app, this would be from the backend)
      const profile = await this.getCustomerProfile(customerId);
      
      // Generate personalized coupons based on purchase history
      const personalizedCoupons: PersonalizedCoupon[] = [];
      
      // Add coupons based on frequent purchases
      const frequentItems = profile.purchaseHistory.filter(item => 
        item.purchaseFrequency === 'frequent'
      );
      
      frequentItems.forEach(item => {
        personalizedCoupons.push({
          id: `pc-${item.productId}`,
          title: `20% Off`,
          description: item.productName,
          image: this.getImageForProduct(item.productName),
          expiresAt: this.getExpirationDate(24), // Setting to today
          category: item.category,
          value: this.calculateDiscountValue(item.productName),
          reason: `Because you frequently purchase ${item.productName}`,
          priority: 10,
          conversionProbability: 0.85
        });
      });
      
      // Add cross-sell recommendations
      if (profile.purchaseHistory.some(item => item.category === 'Bakery')) {
        personalizedCoupons.push({
          id: "cs-jam",
          title: "Buy One Get One Free",
          description: "Premium Fruit Jam",
          image: "https://images.unsplash.com/photo-1564493292945-8c0185b1038c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
          expiresAt: this.getExpirationDate(12), // 12 hours from now
          category: "Spreads",
          value: 4.99,
          reason: "Great with your Sourdough Bread!",
          priority: 8,
          conversionProbability: 0.72
        });
      }
      
      // Add coupons for items they haven't bought recently
      const occasionalItems = profile.purchaseHistory.filter(item => 
        item.purchaseFrequency === 'occasional' && 
        new Date(item.lastPurchased).getTime() < Date.now() - 10 * 24 * 60 * 60 * 1000 // Not purchased in the last 10 days
      );
      
      occasionalItems.forEach(item => {
        personalizedCoupons.push({
          id: `pc-remind-${item.productId}`,
          title: `Save $2.00`,
          description: item.productName,
          image: this.getImageForProduct(item.productName),
          expiresAt: this.getExpirationDate(24), // 24 hours from now
          category: item.category,
          value: 2.00,
          reason: `It's been a while since you purchased ${item.productName}`,
          priority: 5,
          conversionProbability: 0.65
        });
      });
      
      // Add a special in-store only offer
      personalizedCoupons.push({
        id: "special-in-store",
        title: "Today Only: 30% Off",
        description: "Fresh Prepared Meals",
        image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
        expiresAt: this.getExpirationDate(8), // 8 hours from now
        category: "Prepared Foods",
        value: 5.99,
        reason: "Special in-store offer just for you!",
        priority: 15,
        conversionProbability: 0.78
      });
      
      // Add new AI-generated recommendations based on shopping patterns
      if (profile.shoppingPatterns) {
        const { preferredDayOfWeek, averageSpendPerVisit, priceConsciousness } = profile.shoppingPatterns;
        
        // AI-generated based on shopping day pattern
        if (preferredDayOfWeek === "Sunday") {
          personalizedCoupons.push({
            id: "ai-timing-sunday",
            title: "Early Bird: 15% Off",
            description: "Your entire purchase before 10am on Sundays",
            image: "https://images.unsplash.com/photo-1506485338023-6ce5f36692df?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
            expiresAt: this.getNextDayOfWeek("Sunday").toISOString(),
            value: averageSpendPerVisit * 0.15,
            reason: "AI noticed you shop on busy Sundays - try an earlier, quieter time!",
            priority: 20,
            aiGenerated: true,
            conversionProbability: 0.68
          });
        }
        
        // AI-generated based on price consciousness
        if (priceConsciousness === "medium" || priceConsciousness === "high") {
          personalizedCoupons.push({
            id: "ai-bundle-savings",
            title: "Smart Bundle: Save $12",
            description: "When you buy 3+ items from your usual categories",
            image: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
            expiresAt: this.getExpirationDate(72), // 3 days
            value: 12.00,
            reason: "AI created this bundle based on your shopping patterns",
            priority: 18,
            aiGenerated: true,
            conversionProbability: 0.82
          });
        }
      }
      
      // Sort by AI-predicted conversion probability and priority
      return personalizedCoupons.sort((a, b) => {
        // Prioritize higher conversion probability first
        if (a.conversionProbability && b.conversionProbability) {
          return b.conversionProbability - a.conversionProbability;
        }
        // Fall back to priority if no conversion probability
        return b.priority - a.priority;
      });
    } catch (error) {
      console.error("Error getting personalized coupons:", error);
      return [];
    }
  }
  
  // Get shopping pattern insights for the customer
  async getShoppingPatternInsights(customerId: string): Promise<any[]> {
    try {
      const profile = await this.getCustomerProfile(customerId);
      
      // AI-generated insights based on the customer profile
      return [
        {
          type: 'timing',
          title: 'Best Shopping Time',
          description: `You typically shop on ${profile.shoppingPatterns.preferredDayOfWeek} mornings, which is one of our busiest times.`,
          recommendation: 'Try shopping on Tuesday afternoons for a more relaxed experience and fresher produce.',
          impact: 'positive'
        },
        {
          type: 'savings',
          title: 'Potential Savings',
          description: `Based on your usual purchases, you could save approximately $${(profile.shoppingPatterns.averageSpendPerVisit * 0.12).toFixed(2)} per visit by using personalized coupons.`,
          recommendation: 'Save the coupons that match your usual purchases before your next shopping trip.',
          impact: 'positive'
        },
        {
          type: 'product',
          title: 'Frequent Repurchases',
          description: 'You regularly buy Premium Coffee Beans every 2-3 weeks.',
          recommendation: 'Consider subscribing to our coffee delivery program for a 10% discount and never run out.',
          impact: 'neutral'
        }
      ];
    } catch (error) {
      console.error("Error getting shopping pattern insights:", error);
      return [];
    }
  }

  // Helper to get a product image (in a real app, this would come from product catalog)
  private getImageForProduct(productName: string): string {
    // Map common product names to images
    const imageMap: Record<string, string> = {
      "Organic Bananas": "https://images.unsplash.com/photo-1603833665858-e61d17a86224?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "Stacy's Pita Chips": "/lovable-uploads/7ebdba46-cfd6-4842-b7a0-3ba927797be4.png",
      "Premium Coffee Beans": "https://images.unsplash.com/photo-1497636577773-f1231844b336?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "Sourdough Bread": "https://images.unsplash.com/photo-1549931319-a545dcf3bc7c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"
    };
    
    return imageMap[productName] || "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80";
  }
  
  // Helper to calculate a discount value based on product
  private calculateDiscountValue(productName: string): number {
    // Simplified logic - in a real app, this would use real product pricing
    const baseValues: Record<string, number> = {
      "Organic Bananas": 1.99,
      "Stacy's Pita Chips": 3.99,
      "Premium Coffee Beans": 8.99,
      "Sourdough Bread": 4.99
    };
    
    return baseValues[productName] ? baseValues[productName] * 0.2 : 2.50; // 20% of price or default $2.50
  }
  
  // Helper to get expiration date - always set to end of today
  private getExpirationDate(hoursFromNow: number): string {
    const date = new Date();
    date.setTime(date.getTime() + hoursFromNow * 60 * 60 * 1000);
    return date.toISOString();
  }
  
  // Get the next occurrence of a specific day of the week
  private getNextDayOfWeek(dayName: string): Date {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(dayName.toLowerCase());
    if (targetDay < 0) return new Date(); // Invalid day name
    
    const today = new Date();
    const currentDay = today.getDay();
    const distance = (targetDay + 7 - currentDay) % 7;
    
    const result = new Date();
    result.setDate(today.getDate() + distance);
    return result;
  }
  
  // In a real implementation, this would connect to store systems
  async detectStoreEntry(userId: string, storeId: string): Promise<{
    detected: boolean;
    timestamp: string;
    storeName: string;
  }> {
    // Simulate store entry detection
    console.log(`Detecting store entry for user ${userId} at store ${storeId}`);
    
    return {
      detected: true,
      timestamp: new Date().toISOString(),
      storeName: "H-E-B Central"
    };
  }
}

export const personalizationService = new PersonalizationService();
