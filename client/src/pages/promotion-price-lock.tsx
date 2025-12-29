import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, CheckCircle, ArrowLeft, Send, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

const formSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  websiteUrl: z.string().min(1, "URL сайта обязателен").url("Введите корректный URL"),
  inn: z.string().optional(),
  socialNetwork: z.string().optional(),
  messengerContact: z.string().optional(),
  privacyConsent: z.boolean().refine(val => val === true, {
    message: "Необходимо согласие на обработку персональных данных",
  }),
  pdnConsent: z.boolean().refine(val => val === true, {
    message: "Необходимо согласие с политикой конфиденциальности",
  }),
  offerConsent: z.boolean().refine(val => val === true, {
    message: "Необходимо принять условия оферты",
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function PromotionPriceLockPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      websiteUrl: "",
      inn: "",
      socialNetwork: "",
      messengerContact: "",
      privacyConsent: false,
      pdnConsent: false,
      offerConsent: false,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/promotion-orders", {
        ...data,
        promotionCode: "PRICE_LOCK_2025",
        promotionTitle: "Зафиксируй цены 2025 года до 31 января 2026 года",
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Заявка отправлена",
        description: "Мы свяжемся с вами в ближайшее время",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить заявку. Попробуйте позже.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    submitMutation.mutate(data);
  };

  if (submitted) {
    return (
      <>
        <Helmet>
          <title>Заявка отправлена | SecureLex.ru</title>
        </Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Заявка успешно отправлена!</h2>
              <p className="text-muted-foreground mb-6">
                Спасибо за участие в акции! Мы свяжемся с вами в ближайшее время 
                для подтверждения фиксации цен 2025 года.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/promotions">
                  <Button variant="outline" className="w-full" data-testid="button-back-to-promotions">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Вернуться к акциям
                  </Button>
                </Link>
                <Link href="/">
                  <Button className="w-full" data-testid="button-go-home">
                    На главную
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Зафиксируй цены 2025 года | SecureLex.ru</title>
        <meta name="description" content="Успейте заказать аудит сайта по ценам 2025 года. Акция действует до 31 января 2026 года." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Link href="/promotions">
            <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к акциям
            </Button>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl">
                Участвую в акции
              </CardTitle>
              <CardDescription className="text-base">
                Зафиксируй цены 2025 года до 31 января 2026 года!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL сайта *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.ru"
                            {...field}
                            data-testid="input-website-url"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ИНН компании</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1234567890"
                            {...field}
                            data-testid="input-inn"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Как к вам обращаться"
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Телефон</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+7 (999) 123-45-67"
                            {...field}
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialNetwork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Мессенджер</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-messenger">
                                <SelectValue placeholder="Выберите" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="telegram">Telegram</SelectItem>
                              <SelectItem value="vk">VK</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="messengerContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Контакт в мессенджере</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="@username или номер"
                              {...field}
                              data-testid="input-messenger-contact"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <FormField
                      control={form.control}
                      name="privacyConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-privacy"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              Согласен на{" "}
                              <Link href="/personal-data" className="text-primary hover:underline">
                                обработку персональных данных
                              </Link>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pdnConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-pdn"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              Ознакомлен с{" "}
                              <Link href="/privacy-policy" className="text-primary hover:underline">
                                политикой конфиденциальности
                              </Link>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="offerConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-offer"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              Принимаю условия{" "}
                              <Link href="/offer" className="text-primary hover:underline">
                                договора оферты
                              </Link>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={submitMutation.isPending}
                    data-testid="button-submit"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Отправить заявку
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
