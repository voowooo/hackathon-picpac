import { CheckoutScreen } from "../screens/CheckoutScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function CheckoutRoute() { return <CheckoutScreen controller={usePicPac()} />; }
