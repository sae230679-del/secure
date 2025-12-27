import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Gift, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { Promotion } from "@shared/schema";

function CountdownTimer({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const difference = end - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="flex items-center gap-1 text-sm">
      <Clock className="h-4 w-4" />
      <span>
        {timeLeft.days > 0 && `${timeLeft.days}д `}
        {String(timeLeft.hours).padStart(2, "0")}:
        {String(timeLeft.minutes).padStart(2, "0")}:
        {String(timeLeft.seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

export function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const savedDismissed = localStorage.getItem("dismissedPromos");
    if (savedDismissed) {
      setDismissed(JSON.parse(savedDismissed));
    }
  }, []);

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/active"],
  });

  const popupPromo = promotions.find(
    (p) => p.showPopup && !dismissed.includes(String(p.id))
  );

  useEffect(() => {
    if (popupPromo) {
      const delay = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(delay);
    }
  }, [popupPromo]);

  const handleDismiss = () => {
    if (popupPromo) {
      const newDismissed = [...dismissed, String(popupPromo.id)];
      setDismissed(newDismissed);
      localStorage.setItem("dismissedPromos", JSON.stringify(newDismissed));
    }
    setIsOpen(false);
  };

  if (!popupPromo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-promo-popup">
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          data-testid="button-close-promo"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl" data-testid="text-promo-title">
            {popupPromo.title}
          </DialogTitle>
          {popupPromo.discountText && (
            <Badge className="mx-auto mt-2" variant="default">
              {popupPromo.discountText}
            </Badge>
          )}
        </DialogHeader>
        
        {popupPromo.description && (
          <DialogDescription className="text-center mt-2">
            {popupPromo.description}
          </DialogDescription>
        )}

        {popupPromo.bannerImageUrl && (
          <div className="mt-4">
            <img
              src={popupPromo.bannerImageUrl}
              alt={popupPromo.title}
              className="rounded-md w-full object-cover max-h-48"
            />
          </div>
        )}

        {popupPromo.showCountdown && popupPromo.endDate && (
          <div className="flex justify-center mt-4 text-muted-foreground">
            <CountdownTimer endDate={new Date(popupPromo.endDate)} />
          </div>
        )}

        <div className="flex flex-col gap-2 mt-4">
          {popupPromo.ctaLink && (
            <Button asChild className="w-full" data-testid="button-promo-cta">
              <Link href={popupPromo.ctaLink} onClick={() => setIsOpen(false)}>
                {popupPromo.ctaText || "Подробнее"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" onClick={handleDismiss} className="w-full" data-testid="button-promo-close">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PromoBanner() {
  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/active"],
  });

  const landingPromo = promotions.find((p) => p.showOnLanding);

  if (!landingPromo) return null;

  return (
    <div
      className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b"
      data-testid="banner-promo-landing"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <span className="font-medium">{landingPromo.title}</span>
            {landingPromo.discountText && (
              <Badge variant="secondary" className="ml-2">
                {landingPromo.discountText}
              </Badge>
            )}
          </div>
          {landingPromo.showCountdown && landingPromo.endDate && (
            <CountdownTimer endDate={new Date(landingPromo.endDate)} />
          )}
          {landingPromo.ctaLink && (
            <Button size="sm" asChild data-testid="button-banner-cta">
              <Link href={landingPromo.ctaLink}>
                {landingPromo.ctaText || "Подробнее"}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
