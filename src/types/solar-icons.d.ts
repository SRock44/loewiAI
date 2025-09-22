declare module 'solar-icons' {
  import { FC, SVGProps } from 'react';
  
  export interface SolarIconProps extends SVGProps<SVGSVGElement> {
    size?: number;
  }
  
  export const ClipboardList: FC<SolarIconProps>;
  export const Home: FC<SolarIconProps>;
  export const TextSquare: FC<SolarIconProps>;
  export const ChatSquare: FC<SolarIconProps>;
  export const Calendar: FC<SolarIconProps>;
  export const QuestionCircle: FC<SolarIconProps>;
  export const Card: FC<SolarIconProps>;
  export const Lightbulb: FC<SolarIconProps>;
  export const Document: FC<SolarIconProps>;
  export const List: FC<SolarIconProps>;
  export const Target: FC<SolarIconProps>;
  export const Paperclip: FC<SolarIconProps>;
  export const ArrowRight: FC<SolarIconProps>;
  export const Pen: FC<SolarIconProps>;
  export const AddSquare: FC<SolarIconProps>;
  export const User: FC<SolarIconProps>;
  export const Settings: FC<SolarIconProps>;
  export const Logout: FC<SolarIconProps>;
}
