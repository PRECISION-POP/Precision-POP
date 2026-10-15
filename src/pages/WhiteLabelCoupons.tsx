import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CouponSwiper from "@/components/CouponSwiper";
import SessionSavingsTracker from "@/components/WhiteLabelSessionSavingsTracker";
import CouponBrowser from "@/components/CouponBrowser";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRetailer } from "@/contexts/BrandContext";
import { Coupon } from "@/components/coupon/types";
import krogerLogo from "@/assets/kroger-logo.png";
import hebLogo from "@/assets/heb-logo.png";
import hebCoupons from "@/data/hebCoupons";

const Coupons = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { retailer, retailerId } = useRetailer();
  const [activeTab, setActiveTab] = useState("discover");
  const [sessionSavings, setSessionSavings] = useState(0);
  const [savedCoupons, setSavedCoupons] = useState<Coupon[]>([]);
  const [customerName, setCustomerName] = useState("Alice");
  
  // Use real H-E-B coupons for both Discover and Browse tabs
  const coupons = hebCoupons;

  useEffect(() => {
    const storedName = sessionStorage.getItem('customerName');
    if (storedName) {
      setCustomerName(storedName);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleSaveCoupon = (coupon: Coupon) => {
    if (!savedCoupons.some(saved => saved.id === coupon.id)) {
      const updatedSavedCoupons = [...savedCoupons, coupon];
      setSavedCoupons(updatedSavedCoupons);
      setSessionSavings(prev => prev + coupon.value);
    }
  };

  const handleCouponSwiped = (couponId: string, direction: string) => {
    const coupon = coupons.find(c => c.id === couponId);
    
    if (!coupon) {
      console.log(`Looking for coupon ${couponId} in already loaded coupons`);
    }
    
    if (direction === "right") {
      if (coupon) {
        handleSaveCoupon(coupon);
      } else {
        const allSwipedCoupons = document.querySelectorAll('[data-coupon-id]');
        allSwipedCoupons.forEach(element => {
          const id = element.getAttribute('data-coupon-id');
          const value = element.getAttribute('data-coupon-value');
          if (id === couponId && value) {
            setSessionSavings(prev => prev + parseFloat(value));
          }
        });
      }
    }
  };

  return (
    <div className="container mx-auto px-1 py-0 mt-0 min-h-screen bg-background">
      <div className="flex justify-center mt-0 mb-[2px]">
        <div className="flex items-center gap-3">
          {retailerId === 'kroger' ? (
            <img 
              src={krogerLogo} 
              alt={`${retailer.name} Logo`}
              className="h-16 w-auto"
            />
          ) : retailerId === 'heb' ? (
            <img 
              src={hebLogo} 
              alt={`${retailer.name} Logo`}
              className="h-16 w-auto"
            />
          ) : (
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-lg"
              style={{ backgroundColor: retailer.theme.primary }}
            >
              {retailer.shortName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: retailer.theme.text }}>
              {retailer.name}
            </h1>
            <p className="text-sm" style={{ color: `${retailer.theme.text}80` }}>
              {retailer.tagline}
            </p>
          </div>
        </div>
      </div>
      
      {isMobile && (
        <div className="absolute top-0 right-0 z-10 mt-1 mr-3">
          <SessionSavingsTracker savedAmount={sessionSavings} mobileView={true} />
        </div>
      )}
      
      {!isMobile && (
        <SessionSavingsTracker savedAmount={sessionSavings} />
      )}
      
      <motion.div
        className="p-0 mb-[2px] rounded-lg text-center text-white"
        style={{ backgroundColor: retailer.theme.primary }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-extrabold text-center py-1">
          {customerName}'s Daily Deals
        </h2>
      </motion.div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0">
        <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-muted mt-0">
          <TabsTrigger value="discover" className="py-0 text-sm">Discover</TabsTrigger>
          <TabsTrigger value="browse" className="py-0 text-sm">Browse</TabsTrigger>
          <TabsTrigger value="saved" className="py-0 text-sm">Saved</TabsTrigger>
        </TabsList>
        
        <TabsContent value="discover" className="mt-0 pt-0">
          <CouponSwiper
            onCouponSwiped={handleCouponSwiped}
            onViewSaved={() => setActiveTab("saved")}
          />
        </TabsContent>
        
        <TabsContent value="browse" className="mt-0">
          <CouponBrowser 
            coupons={coupons}
            onSaveCoupon={handleSaveCoupon}
          />
        </TabsContent>
        
        <TabsContent value="saved" className="mt-0">
          {savedCoupons.length > 0 ? (
            <div className="space-y-1">
              <div className="glass-card p-1 text-center">
                <h3 className="text-sm font-medium">Your Saved Coupons</h3>
                <p className="text-muted-foreground text-xs">Show these at checkout for instant savings</p>
              </div>
              <div className="grid grid-cols-1 gap-1 max-h-[50vh] overflow-y-auto">
                {savedCoupons.map(coupon => (
                  <div 
                    key={coupon.id} 
                    className="glass-card p-2 rounded-lg flex items-center gap-2"
                  >
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                      <img 
                        src={coupon.image} 
                        alt={coupon.description}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 
                        className="font-medium text-xs"
                        style={{ color: retailer.theme.primary }}
                      >
                        {coupon.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{coupon.description}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Expires: {new Date(coupon.expiresAt).toLocaleDateString()}
                        </span>
                        <span 
                          className="font-bold text-xs"
                          style={{ color: retailer.theme.success }}
                        >
                          ${coupon.value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-2 text-center">
              <h3 className="text-sm font-medium mb-1">Your Saved Coupons</h3>
              <p className="text-muted-foreground text-xs">Swipe right on coupons or browse to save them here for easy access at checkout.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Coupons;
