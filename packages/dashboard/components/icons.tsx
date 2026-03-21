import {
  ArrowDown as PhArrowDown,
  ArrowUp as PhArrowUp,
  Bell as BellIcon,
  Binoculars,
  CaretDown,
  ChartLineUp,
  DotsThreeVertical,
  FileText,
  Funnel,
  Globe,
  Lifebuoy,
  List,
  MagnifyingGlass,
  MapTrifold,
  PawPrint,
  Scroll,
  SquaresFour,
  TreeStructure,
  Truck,
  Warning,
  X,
} from "@phosphor-icons/react";

const sm = 18;
const md = 24;
const xs = 14;
const chevron = 16;

const w = "regular" as const;

export const Dashboard = () => <SquaresFour size={sm} weight={w} aria-hidden />;

export const Map = () => <MapTrifold size={sm} weight={w} aria-hidden />;

export const Alert = () => <BellIcon size={sm} weight={w} aria-hidden />;

export const Zone = () => <Globe size={sm} weight={w} aria-hidden />;

export const Animal = () => <PawPrint size={sm} weight={w} aria-hidden />;

export const Species = () => <TreeStructure size={sm} weight={w} aria-hidden />;

export const Sighting = () => <Binoculars size={sm} weight={w} aria-hidden />;

export const Dispatch = () => <Truck size={sm} weight={w} aria-hidden />;

export const Report = () => <FileText size={sm} weight={w} aria-hidden />;

export const Logs = () => <Scroll size={sm} weight={w} aria-hidden />;

export const Bell = () => <BellIcon size={sm} weight={w} aria-hidden />;

export const Support = () => <Lifebuoy size={sm} weight={w} aria-hidden />;

export const Menu = () => <List size={md} weight={w} aria-hidden />;

export const Close = () => <X size={md} weight={w} aria-hidden />;

export const Search = () => <MagnifyingGlass size={sm} weight={w} aria-hidden />;

export const MoreVertical = () => <DotsThreeVertical size={sm} weight={w} aria-hidden />;

export const ChevronDown = () => <CaretDown size={chevron} weight={w} aria-hidden />;

export const ArrowUp = () => <PhArrowUp size={xs} weight={w} aria-hidden />;

export const ArrowDown = () => <PhArrowDown size={xs} weight={w} aria-hidden />;

export const Filter = () => <Funnel size={sm} weight={w} aria-hidden />;

export const Stable = () => <ChartLineUp size={sm} weight={w} aria-hidden />;

export const Risk = () => <Warning size={sm} weight={w} aria-hidden />;

export const Icons = {
  Dashboard,
  Map,
  Alert,
  Zone,
  Animal,
  Species,
  Sighting,
  Dispatch,
  Report,
  Logs,
  Bell,
  Support,
  Menu,
  Close,
  Search,
  MoreVertical,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Stable,
  Risk,
};
