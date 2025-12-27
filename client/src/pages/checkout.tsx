import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  PAYMENT_METHODS, 
  type PaymentMethodType, 
  YookassaLogo,
  PaymentMethodsDisplay 
} from "@/components/payment-icons";
import { formatPrice } from "@/lib/packages-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Audit, Payment } from "@shared/schema";
import {
  Shield,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Lock,
  AlertCircle,
  Clock,
  Building2,
  Tag,
  X,
  Percent,
  CreditCard,
  Wallet,
} from "lucide-react";

type InstallmentsSettings = {
  yookassaEnabled: boolean;
  robokassaEnabled: boolean;
  bannerTitle: string;
  bannerText: string;
};

type PaymentStatus = "idle" | "processing" | "success" | "error";

export default function CheckoutPage() {
  const [, params] = useRoute("/checkout/:auditId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const auditId = params?.auditId ? parseInt(params.auditId) : null;
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>("sbp");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [isB2B, setIsB2B] = useState(false);
  
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    id: number;
    code: string;
    discountType: string;
    discountPercent: number | null;
    discountAmount: number | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false);
  
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [pdnConsentAccepted, setPdnConsentAccepted] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);

  const { data: installmentsSettings } = useQuery<InstallmentsSettings>({
    queryKey: ["/api/public/installments-settings"],
  });

  const hasInstallmentsEnabled = installmentsSettings?.yookassaEnabled || installmentsSettings?.robokassaEnabled;

  const { data: audit, isLoading: auditLoading } = useQuery<Audit>({
    queryKey: ["/api/audits", auditId],
    enabled: !!auditId,
  });

  const { data: auditPackage } = useQuery<{ 
    id: number; 
    name: string; 
    price: number; 
    type: string;
    category: string;
  }>({
    queryKey: [`/api/packages/${audit?.packageId}`],
    enabled: !!audit?.packageId,
  });
  
  const getServiceName = () => {
    if (!auditPackage) return "Аудит сайта";
    if (auditPackage.category === "express_pdf" || auditPackage.type === "expressreport") {
      return "Экспресс-проверка сайта";
    }
    return "Полный аудит сайта";
  };

  const paymentMutation = useMutation({
    mutationFn: async (data: { auditId: number; paymentMethod: PaymentMethodType; promoCodeId?: number; finalAmount?: number }) => {
      const response = await apiRequest("POST", "/api/payments/create", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }
      
      setPaymentStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Оплата успешно завершена",
        description: "Аудит запущен. Вы получите уведомление по завершении.",
      });
      setTimeout(() => {
        navigate(`/dashboard/audits/${auditId}`);
      }, 2000);
    },
    onError: (error: Error) => {
      setPaymentStatus("error");
      toast({
        title: "Ошибка оплаты",
        description: error.message || "Не удалось провести платеж. Попробуйте другой способ.",
        variant: "destructive",
      });
    },
  });

  const promoMutation = useMutation({
    mutationFn: async (data: { code: string; amount: number; targetType: string; targetId: number }) => {
      const response = await apiRequest("POST", "/api/promo-codes/apply", data);
      return response.json();
    },
    onSuccess: (data) => {
      setAppliedPromoCode(data.promoCode);
      setPromoError(null);
      setPromoCodeInput("");
      toast({
        title: "Промокод применён",
        description: `Скидка ${data.promoCode.discountType === "percent" 
          ? `${data.promoCode.discountPercent}%` 
          : formatPrice(data.promoCode.discountAmount || 0)}`,
      });
    },
    onError: (error: Error) => {
      setPromoError(error.message || "Недействительный промокод");
    },
  });

  const handleApplyPromoCode = () => {
    if (!promoCodeInput.trim() || !audit?.packageId || !auditPackage?.price) return;
    setPromoError(null);
    promoMutation.mutate({ 
      code: promoCodeInput.trim().toUpperCase(), 
      amount: auditPackage.price,
      targetType: "packages",
      targetId: audit.packageId,
    });
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoError(null);
  };

  const calculateDiscount = () => {
    if (!appliedPromoCode || !auditPackage?.price) return 0;
    if (appliedPromoCode.discountType === "percent" && appliedPromoCode.discountPercent) {
      return Math.round(auditPackage.price * appliedPromoCode.discountPercent / 100);
    }
    if (appliedPromoCode.discountType === "amount" && appliedPromoCode.discountAmount) {
      return Math.min(appliedPromoCode.discountAmount, auditPackage.price);
    }
    return 0;
  };

  const discount = calculateDiscount();
  const finalAmount = Math.max(0, (auditPackage?.price || 0) - discount);

  const pdnConsentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pdn-consent", { source: "checkout" });
      return response.json();
    },
  });

  const handlePayment = async () => {
    if (!auditId) return;
    if (!privacyAccepted || !pdnConsentAccepted || !offerAccepted) {
      toast({
        title: "Необходимо принять условия",
        description: "Для продолжения оплаты примите политику конфиденциальности, согласие на обработку персональных данных и договор оферты",
        variant: "destructive",
      });
      return;
    }
    
    setPaymentStatus("processing");
    
    try {
      await pdnConsentMutation.mutateAsync();
    } catch {
    }
    
    paymentMutation.mutate({ 
      auditId, 
      paymentMethod: selectedMethod,
      promoCodeId: appliedPromoCode?.id,
      finalAmount,
    });
  };

  const b2bMethods = PAYMENT_METHODS.filter(m => m.isB2B);
  const personalMethods = PAYMENT_METHODS.filter(m => !m.isB2B);

  if (!auditId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Аудит не найден</h2>
            <p className="text-muted-foreground mb-4">
              Пожалуйста, выберите пакет и начните новый аудит
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Вернуться в личный кабинет
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Оплата прошла успешно!</h2>
            <p className="text-muted-foreground mb-4">
              Аудит вашего сайта запущен. Результаты будут готовы в течение указанного времени.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Перенаправление...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Выберите способ оплаты
                </CardTitle>
                <CardDescription>
                  Все способы оплаты безопасны и защищены
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Button
                    variant={!isB2B ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsB2B(false)}
                    data-testid="button-personal-payments"
                  >
                    Для физлиц
                  </Button>
                  <Button
                    variant={isB2B ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsB2B(true)}
                    data-testid="button-b2b-payments"
                  >
                    <Building2 className="h-4 w-4 mr-1" />
                    Для бизнеса (B2B)
                  </Button>
                </div>

                <div className="grid gap-3">
                  {(isB2B ? b2bMethods : personalMethods).map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedMethod === method.id;
                    
                    return (
                      <div
                        key={method.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "hover-elevate"
                        }`}
                        onClick={() => setSelectedMethod(method.id)}
                        data-testid={`payment-method-${method.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Icon className="h-10 w-10 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{method.name}</span>
                              {method.fee === "0%" && (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                  Без комиссии
                                </Badge>
                              )}
                              {method.isB2B && (
                                <Badge variant="outline">B2B</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{method.description}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Комиссия: {method.fee}</span>
                              <span>Лимит: {method.limit}</span>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                            isSelected 
                              ? "border-primary bg-primary" 
                              : "border-muted-foreground/30"
                          }`}>
                            {isSelected && (
                              <CheckCircle2 className="h-full w-full text-primary-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isB2B && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Для юридических лиц:</strong> После оплаты вы получите полный пакет 
                      закрывающих документов: счёт, акт, счёт-фактура.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Безопасная оплата через</span>
                  <YookassaLogo className="h-4" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Ваши платежные данные защищены по стандартам PCI DSS. 
                  Мы не храним данные ваших карт.
                </p>
              </CardContent>
            </Card>

            {hasInstallmentsEnabled && (
              <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-full shrink-0">
                      <Percent className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {installmentsSettings?.bannerTitle || "Оплата в рассрочку"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {installmentsSettings?.bannerText || "Разделите платёж на несколько частей без переплат"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setInstallmentsModalOpen(true)}
                        data-testid="button-installments"
                      >
                        <Percent className="h-3 w-3 mr-1" />
                        Оформить рассрочку
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Ваш заказ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                  </div>
                ) : audit ? (
                  <>
                    <div>
                      <p className="font-medium">{getServiceName()}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {audit.websiteUrlNormalized}
                      </p>
                      {auditPackage?.name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Пакет: {auditPackage.name}
                        </p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Стоимость услуги</span>
                        <span>{formatPrice(auditPackage?.price || 0)}</span>
                      </div>
                      {selectedMethod === "sbp" && (
                        <div className="flex justify-between gap-2 text-green-600">
                          <span>Комиссия СБП</span>
                          <span>0 ₽</span>
                        </div>
                      )}
                      {appliedPromoCode && discount > 0 && (
                        <div className="flex justify-between gap-2 text-green-600">
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Скидка ({appliedPromoCode.code})
                          </span>
                          <span>-{formatPrice(discount)}</span>
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {!appliedPromoCode ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Промокод"
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && handleApplyPromoCode()}
                            className="flex-1"
                            data-testid="input-promo-code"
                          />
                          <Button
                            variant="outline"
                            onClick={handleApplyPromoCode}
                            disabled={!promoCodeInput.trim() || promoMutation.isPending}
                            data-testid="button-apply-promo"
                          >
                            {promoMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Применить"
                            )}
                          </Button>
                        </div>
                        {promoError && (
                          <p className="text-xs text-destructive">{promoError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 p-2 bg-green-500/10 rounded-md">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Tag className="h-4 w-4" />
                          <span className="font-medium">{appliedPromoCode.code}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromoCode}
                          data-testid="button-remove-promo"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between gap-2 font-bold text-lg">
                      <span>Итого</span>
                      <span>{formatPrice(finalAmount)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="privacy-consent"
                          checked={privacyAccepted}
                          onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                          data-testid="checkbox-privacy"
                        />
                        <Label htmlFor="privacy-consent" className="text-sm leading-tight cursor-pointer">
                          Я ознакомлен с{" "}
                          <a 
                            href="/privacy-policy" 
                            target="_blank" 
                            className="text-primary underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            политикой конфиденциальности
                          </a>
                        </Label>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="pdn-consent"
                          checked={pdnConsentAccepted}
                          onCheckedChange={(checked) => setPdnConsentAccepted(checked === true)}
                          data-testid="checkbox-pdn-consent"
                        />
                        <Label htmlFor="pdn-consent" className="text-sm leading-tight cursor-pointer">
                          Даю{" "}
                          <a 
                            href="/personal-data-agreement" 
                            target="_blank" 
                            className="text-primary underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            согласие на обработку персональных данных
                          </a>
                        </Label>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="offer-consent"
                          checked={offerAccepted}
                          onCheckedChange={(checked) => setOfferAccepted(checked === true)}
                          data-testid="checkbox-offer"
                        />
                        <Label htmlFor="offer-consent" className="text-sm leading-tight cursor-pointer">
                          Принимаю условия{" "}
                          <a 
                            href="/offer" 
                            target="_blank" 
                            className="text-primary underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            договора оферты
                          </a>
                        </Label>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Загрузка...</p>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handlePayment}
                  disabled={paymentStatus === "processing" || !audit || !privacyAccepted || !pdnConsentAccepted || !offerAccepted}
                  data-testid="button-pay"
                >
                  {paymentStatus === "processing" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      Оплатить {formatPrice(finalAmount)}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Тестовый режим</h4>
              <p className="text-xs text-muted-foreground">
                Платежная система работает в демо-режиме. 
                Реальные платежи будут доступны после подключения API ЮKassa.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={installmentsModalOpen} onOpenChange={setInstallmentsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Оплата в рассрочку
            </DialogTitle>
            <DialogDescription>
              Выберите платежную систему для оформления рассрочки
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {installmentsSettings?.yookassaEnabled && (
              <div
                className="p-4 border rounded-lg cursor-pointer hover-elevate"
                onClick={() => {
                  toast({
                    title: "Рассрочка ЮKassa",
                    description: "Переход на страницу оформления рассрочки...",
                  });
                  setInstallmentsModalOpen(false);
                }}
                data-testid="installments-yookassa"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">ЮKassa — Оплата частями</p>
                    <p className="text-sm text-muted-foreground">
                      Рассрочка через банки-партнёры ЮKassa
                    </p>
                  </div>
                </div>
              </div>
            )}
            {installmentsSettings?.robokassaEnabled && (
              <div
                className="p-4 border rounded-lg cursor-pointer hover-elevate"
                onClick={() => {
                  toast({
                    title: "Рассрочка Robokassa",
                    description: "Переход на страницу оформления рассрочки...",
                  });
                  setInstallmentsModalOpen(false);
                }}
                data-testid="installments-robokassa"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">Robokassa — Кредит</p>
                    <p className="text-sm text-muted-foreground">
                      Кредитование через Тинькофф, Почта Банк
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            После выбора вы будете перенаправлены на страницу оформления рассрочки.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
