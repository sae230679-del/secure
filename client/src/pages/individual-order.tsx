import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CheckCircle2,
  Loader2,
  Send,
  Globe,
  User,
  Phone,
  Mail,
  Building2,
  MessageCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function IndividualOrderPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    socialNetwork: "" as "" | "telegram" | "whatsapp" | "vk",
    socialHandle: "",
    websiteUrl: "",
    inn: "",
    isIndividual: false,
    description: "",
  });
  
  const [consents, setConsents] = useState({
    privacy: false,
    pdn: false,
    offer: false,
  });
  
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/public/individual-order", {
        ...data,
        inn: data.isIndividual ? null : data.inn || null,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка отправки заявки");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Заявка отправлена",
        description: "Мы свяжемся с вами в ближайшее время",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      toast({
        title: "Укажите email",
        description: "Email обязателен для связи",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.websiteUrl.trim()) {
      toast({
        title: "Укажите URL сайта",
        description: "URL сайта обязателен для заявки",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.isIndividual && !formData.inn.trim()) {
      toast({
        title: "Укажите ИНН",
        description: "Укажите ИНН организации или отметьте, что вы физическое лицо",
        variant: "destructive",
      });
      return;
    }
    
    if (!consents.privacy || !consents.pdn || !consents.offer) {
      toast({
        title: "Необходимо согласие",
        description: "Подтвердите все согласия для отправки заявки",
        variant: "destructive",
      });
      return;
    }
    
    submitMutation.mutate(formData);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Заявка отправлена</h2>
              <p className="text-muted-foreground mb-6">
                Мы получили вашу заявку и свяжемся с вами в ближайшее время для обсуждения деталей.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate("/")} data-testid="button-go-home">
                  На главную
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsSubmitted(false);
                    setFormData({
                      name: "",
                      email: "",
                      phone: "",
                      socialNetwork: "",
                      socialHandle: "",
                      websiteUrl: "",
                      inn: "",
                      isIndividual: false,
                      description: "",
                    });
                    setConsents({ privacy: false, pdn: false, offer: false });
                  }}
                  data-testid="button-new-order"
                >
                  Новая заявка
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Индивидуальный заказ</h1>
          <p className="text-muted-foreground">
            Нужен нестандартный аудит или особые условия? Оставьте заявку.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Заявка на индивидуальный заказ
            </CardTitle>
            <CardDescription>
              Опишите ваш запрос, и мы подготовим персональное предложение
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Имя
                    <span className="text-muted-foreground text-xs">(необязательно)</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Иван Иванов"
                    data-testid="input-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Телефон
                    <span className="text-muted-foreground text-xs">(необязательно)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+7 (999) 123-45-67"
                    data-testid="input-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Мессенджер
                    <span className="text-muted-foreground text-xs">(необязательно)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.socialNetwork}
                      onValueChange={(value) => setFormData({ ...formData, socialNetwork: value as typeof formData.socialNetwork })}
                    >
                      <SelectTrigger className="w-[130px]" data-testid="select-social-network">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="vk">VK</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={formData.socialHandle}
                      onChange={(e) => setFormData({ ...formData, socialHandle: e.target.value })}
                      placeholder={formData.socialNetwork === "telegram" ? "@username" : "Номер/ссылка"}
                      className="flex-1"
                      data-testid="input-social-handle"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  URL сайта
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://example.ru"
                  required
                  data-testid="input-website-url"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isIndividual"
                    checked={formData.isIndividual}
                    onCheckedChange={(checked) => setFormData({ ...formData, isIndividual: !!checked, inn: "" })}
                    data-testid="checkbox-is-individual"
                  />
                  <Label htmlFor="isIndividual" className="cursor-pointer">
                    Я физическое лицо
                  </Label>
                </div>
                
                {!formData.isIndividual && (
                  <div className="space-y-2">
                    <Label htmlFor="inn" className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      ИНН организации
                      <span className="text-muted-foreground text-xs">(необязательно)</span>
                    </Label>
                    <Input
                      id="inn"
                      value={formData.inn}
                      onChange={(e) => setFormData({ ...formData, inn: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                      placeholder="10 или 12 цифр"
                      maxLength={12}
                      data-testid="input-inn"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание запроса</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Опишите, какой аудит или услуга вам нужна..."
                  rows={4}
                  data-testid="textarea-description"
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacy"
                    checked={consents.privacy}
                    onCheckedChange={(checked) => setConsents({ ...consents, privacy: !!checked })}
                    data-testid="checkbox-privacy"
                  />
                  <Label htmlFor="privacy" className="text-sm leading-tight cursor-pointer">
                    Ознакомлен(а) с{" "}
                    <Link href="/privacy-policy" className="text-primary underline">
                      Политикой конфиденциальности
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pdn"
                    checked={consents.pdn}
                    onCheckedChange={(checked) => setConsents({ ...consents, pdn: !!checked })}
                    data-testid="checkbox-pdn"
                  />
                  <Label htmlFor="pdn" className="text-sm leading-tight cursor-pointer">
                    Даю согласие на{" "}
                    <Link href="/personal-data-agreement" className="text-primary underline">
                      обработку персональных данных
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="offer"
                    checked={consents.offer}
                    onCheckedChange={(checked) => setConsents({ ...consents, offer: !!checked })}
                    data-testid="checkbox-offer"
                  />
                  <Label htmlFor="offer" className="text-sm leading-tight cursor-pointer">
                    Принимаю условия{" "}
                    <Link href="/offer" className="text-primary underline">
                      публичной оферты
                    </Link>
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitMutation.isPending}
                data-testid="button-submit-order"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Отправить заявку
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Хотите быструю проверку?{" "}
            <Link href="/#check" className="text-primary underline">
              Экспресс-проверка
            </Link>
            {" "}бесплатна и занимает 2 минуты.
          </p>
        </div>
      </div>
    </div>
  );
}
