import { OrdersScreen } from "../screens/OrdersScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function OrdersRoute() { return <OrdersScreen controller={usePicPac()} />; }
