// Type declarations for React Three Fiber JSX elements
import { ThreeElements } from '@react-three/fiber';

declare global {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements { }
    }
}

export { };
