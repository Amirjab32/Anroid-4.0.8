import {
  CheckSquare,
  Columns3,
  Repeat,
  ArrowUpCircle,
  Brain,
  ClipboardList,
  Notebook,
  Flame,
  Calendar,
  LucideIcon,
} from "lucide-react";

export type MainNavId =
  | "tasks"
  | "kanban"
  | "planner"
  | "habits"
  | "going_up"
  | "srs"
  | "quiz"
  | "motivation"
  | "notes";

export type AppViewId = MainNavId | "settings";

export interface NavItemConfig {
  id: MainNavId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: "tasks",
    label: "مدیریت تسک",
    description: "لیست کارهای روزانه، برچسب‌ها و زمان‌سنج",
    icon: CheckSquare,
  },
  {
    id: "kanban",
    label: "کانبان",
    description: "تخته‌بندی وضعیت انجام کارها",
    icon: Columns3,
  },
  {
    id: "planner",
    label: "پلنر",
    description: "برنامه‌ریزی ساعتی و تایمر زنده روز",
    icon: Calendar,
  },
  {
    id: "habits",
    label: "ردیاب عادت",
    description: "پیگیری عادت‌های روزانه و زنجیره استمرار",
    icon: Repeat,
  },
  {
    id: "going_up",
    label: "بالا رفتن",
    description: "امتیازدهی و ارزیابی روزانه پیشرفت",
    icon: ArrowUpCircle,
  },
  {
    id: "srs",
    label: "مرور فاصله‌دار",
    description: "مرور هوشمند مطالب با فاصله زمانی",
    icon: Brain,
  },
  {
    id: "quiz",
    label: "ردیاب تست",
    description: "ثبت و آمار تست‌های درسی",
    icon: ClipboardList,
  },
  {
    id: "motivation",
    label: "انگیزه و اهداف",
    description: "روزشمار هدف‌ها و یادآورهای انگیزشی",
    icon: Flame,
  },
  {
    id: "notes",
    label: "دفترچه یادداشت",
    description: "یادداشت‌های دسته‌بندی‌شده و سریع",
    icon: Notebook,
  },
];

export const MAIN_NAV_IDS: MainNavId[] = NAV_ITEMS.map((item) => item.id);

export const VIEW_TITLES: Record<string, string> = {
  tasks: "مدیریت تسک",
  kanban: "کانبان",
  planner: "پلنر",
  habits: "ردیاب عادت",
  going_up: "بالا رفتن",
  srs: "مرور فاصله‌دار",
  quiz: "ردیاب تست",
  motivation: "انگیزه و اهداف",
  notes: "دفترچه یادداشت",
  settings: "تنظیمات",
};

export function isMainNavId(value: string): value is MainNavId {
  return MAIN_NAV_IDS.includes(value as MainNavId);
}
