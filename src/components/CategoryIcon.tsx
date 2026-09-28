import React from 'react';
import {
  Brain,
  Dumbbell,
  BookOpen,
  Activity,
  Laptop,
  Flame,
  Heart,
  Sparkles,
  Code,
  Coffee,
  Music,
  Smile,
  Compass,
  Sun,
  Moon,
  Target,
  Zap,
  Briefcase,
  CheckCircle2,
  Calendar,
  PenTool,
  Terminal,
  FileText,
  Calculator,
  Database,
  Cpu,
  Layers,
  Footprints,
  Bike,
  Timer,
  Apple,
  Trophy,
  ShieldCheck,
  Feather,
  Flower2,
  Eye,
  TreePine,
  Mountain,
  Camera,
  Palette,
  Brush,
  Film,
  Headphones,
  Gamepad2,
  Utensils,
  Plane,
  ShoppingBag,
  Home,
  GraduationCap,
  Library,
  Globe,
  Bookmark,
  Award,
  Search,
  TrendingUp,
  Lightbulb,
  Crosshair,
  Pencil,
  Wrench,
  Dna,
  HeartHandshake,
  HandHeart,
  Users,
  Tent,
  Scroll,
  XCircle,
  LucideIcon
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  // Productivity & Work
  Laptop,
  Code,
  Briefcase,
  Brain,
  PenTool,
  Terminal,
  FileText,
  Calculator,
  Database,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  Pencil,
  Wrench,

  // Health & Fitness
  Dumbbell,
  Activity,
  Flame,
  Heart,
  Zap,
  Footprints,
  Bike,
  Timer,
  Apple,
  Trophy,
  ShieldCheck,
  Dna,

  // Mindfulness & Spirit
  Sun,
  Moon,
  Compass,
  BookOpen,
  Feather,
  Flower2,
  Eye,
  TreePine,
  Mountain,
  HeartHandshake,
  HandHeart,
  Users,
  Tent,
  Scroll,
  Smile,

  // Lifestyle & Hobbies
  Coffee,
  Music,
  Camera,
  Palette,
  Brush,
  Film,
  Headphones,
  Gamepad2,
  Utensils,
  Plane,
  ShoppingBag,
  Home,

  // Learning & Goals
  GraduationCap,
  Library,
  Globe,
  Bookmark,
  Award,
  Search,
  Target,
  TrendingUp,
  Lightbulb,
  Crosshair,
  Calendar,
};

export interface IconCategoryGroup {
  name: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategoryGroup[] = [
  {
    name: 'Work & Tech',
    icons: ['Laptop', 'Code', 'Terminal', 'Brain', 'Briefcase', 'Database', 'Cpu', 'Layers', 'PenTool', 'FileText', 'Sparkles'],
  },
  {
    name: 'Fitness & Health',
    icons: ['Dumbbell', 'Activity', 'Flame', 'Heart', 'Zap', 'Footprints', 'Bike', 'Timer', 'Apple', 'Trophy', 'ShieldCheck'],
  },
  {
    name: 'Mindfulness & Nature',
    icons: ['Sun', 'Moon', 'Compass', 'BookOpen', 'Feather', 'Flower2', 'TreePine', 'Mountain', 'HeartHandshake', 'Eye', 'Smile'],
  },
  {
    name: 'Hobbies & Creative',
    icons: ['Coffee', 'Music', 'Camera', 'Palette', 'Brush', 'Film', 'Headphones', 'Gamepad2', 'Utensils', 'Plane', 'Home'],
  },
  {
    name: 'Study & Ambition',
    icons: ['GraduationCap', 'Library', 'Globe', 'Target', 'TrendingUp', 'Lightbulb', 'Award', 'Bookmark', 'Search', 'Crosshair'],
  },
];

export const POPULAR_EMOJIS = [
  '💻', '🏃', '📚', '🧘', '⚡', '🔥', '💪', '🎯',
  '☕', '🎨', '🎵', '🌿', '🧠', '🚀', '⭐', '✨',
  '🍎', '🏆', '✍️', '🚲', '🏖️', '🛠️', '🔬', '💡'
];

export const EMOJI_TO_LUCIDE: Record<string, string> = {
  '👥': 'Users',
  '🙏': 'HeartHandshake',
  '🍲': 'Utensils',
  '📖': 'BookOpen',
  '📚': 'BookOpen',
  '✈️': 'Plane',
  '✨': 'Sparkles',
  '☀️': 'Sun',
  '🌅': 'Sun',
  '🏕️': 'Tent',
  '⛺': 'Tent',
  '❤️': 'Heart',
  '💖': 'Heart',
  '🧘': 'HeartHandshake',
  '🏃': 'Activity',
  '💻': 'Laptop',
  '🎯': 'Target',
  '🎓': 'GraduationCap',
  '🎵': 'Music',
  '🎨': 'Palette',
};

export const NAME_TO_LUCIDE: Record<string, string> = {
  'Sabha': 'Users',
  'Yuva Seva': 'Users',
  'Seva': 'HeartHandshake',
  'Thaal': 'Utensils',
  'Kathavarta': 'BookOpen',
  'Padhramni': 'Compass',
  'Guruhari Darshan': 'Sun',
  'Mahapuja': 'Sparkles',
  'Shibir': 'Tent',
  'GATE': 'GraduationCap',
  'Travel': 'Plane',
};

export const resolveMigratedIcon = (iconName: string, categoryName?: string): string => {
  if (ICON_MAP[iconName]) return iconName;
  if (EMOJI_TO_LUCIDE[iconName]) return EMOJI_TO_LUCIDE[iconName];
  if (categoryName && NAME_TO_LUCIDE[categoryName]) return NAME_TO_LUCIDE[categoryName];
  return iconName;
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

interface CategoryIconProps {
  name: string;
  categoryName?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  categoryName,
  className = 'w-5 h-5',
  size,
}) => {
  if (!name) {
    if (categoryName && NAME_TO_LUCIDE[categoryName]) {
      const Resolved = ICON_MAP[NAME_TO_LUCIDE[categoryName]];
      if (Resolved) return <Resolved className={className} size={size} />;
    }
    return <Sparkles className={className} size={size} />;
  }

  // 1. Direct match in Lucide icon map
  const IconComponent = ICON_MAP[name];
  if (IconComponent) {
    return <IconComponent className={className} size={size} />;
  }

  // 2. Safe emoji-to-Lucide line icon migration
  const migratedLucideName = EMOJI_TO_LUCIDE[name] || (categoryName ? NAME_TO_LUCIDE[categoryName] : undefined);
  if (migratedLucideName && ICON_MAP[migratedLucideName]) {
    const MigratedComponent = ICON_MAP[migratedLucideName];
    return <MigratedComponent className={className} size={size} />;
  }

  // 3. Fallback: emoji or unicode character
  const isEmoji = /\p{Extended_Pictographic}/u.test(name) || name.length <= 4;
  if (isEmoji) {
    return (
      <span className={`inline-flex items-center justify-center leading-none select-none text-base ${className}`}>
        {name}
      </span>
    );
  }

  return <Sparkles className={className} size={size} />;
};

