export type TransportOptionHelp = {
  definition: string;
  example: string;
  clarification?: string;
};

export type TransportOptionItem = {
  id: string;
  label: string;
  help: TransportOptionHelp;
};

export const TRANSPORT_SERVICE_OPTIONS: readonly TransportOptionItem[] = [
  {
    id: "travel_trailer",
    label: "Travel-trailer transport",
    help: {
      definition: "Tow conventional bumper-pull travel trailers using a properly rated tow vehicle and hitch setup.",
      example: "Moving a 30-foot travel trailer from an RV dealership to the owner’s seasonal campsite.",
    },
  },
  {
    id: "fifth_wheel",
    label: "Fifth-wheel transport",
    help: {
      definition: "Tow RVs that connect to a fifth-wheel hitch mounted in the bed of a suitable pickup truck.",
      example: "Relocating a 40-foot fifth wheel between an RV park in Texas and a winter site in Arizona.",
    },
  },
  {
    id: "driveaway",
    label: "Motorhome drive-away",
    help: {
      definition: "A driver moves an operable motorhome itself instead of towing it on a trailer.",
      example: "Driving a roadworthy Class A motorhome from the owner’s home to a repair facility.",
      clarification: "The motorhome must be legally operable and suitable for the planned trip.",
    },
  },
  {
    id: "towaway",
    label: "Tow-away & hitch service",
    help: {
      definition: "The provider supplies the tow vehicle and appropriate hitch equipment to move a towable RV.",
      example: "Picking up a bumper-pull camper from a private seller and delivering it to the buyer.",
    },
  },
  {
    id: "local_relocation",
    label: "Local campsite & storage moves",
    help: {
      definition: "Short-distance RV relocation between nearby properties, campgrounds, dealerships, or storage facilities.",
      example: "Moving a fifth wheel from a storage lot to a campsite within the same city.",
    },
  },
  {
    id: "long_distance",
    label: "Long-distance & cross-country routes",
    help: {
      definition: "RV transportation across longer regional, interstate, or nationwide routes.",
      example: "Transporting a travel trailer from Florida to Colorado.",
    },
  },
  {
    id: "non_operational",
    label: "Non-operational / flatbed hauling",
    help: {
      definition: "Transport for an RV that cannot be safely driven or conventionally towed and may require a winch, flatbed, or equipment trailer.",
      example: "Hauling a damaged camper with unsafe tires to a repair facility.",
      clarification: "Select this only when you have suitable loading and securement equipment.",
    },
  },
  {
    id: "oversized",
    label: "Specialized or oversized transport",
    help: {
      definition: "Movement of unusually wide, tall, long, or heavy RVs requiring specialized equipment or additional route planning.",
      example: "Moving a wide-body park model that may require permits or escort coordination.",
      clarification: "Select this only if your equipment is suitable. Requirements vary by route and jurisdiction.",
    },
  },
] as const;

export const TRANSPORT_EQUIPMENT_OPTIONS: readonly TransportOptionItem[] = [
  {
    id: "heavy_duty_truck",
    label: "Heavy-duty pickup / dually",
    help: {
      definition: "A properly rated pickup truck suitable for the RV weights and towing configuration you accept.",
      example: "A one-ton dually configured to tow a large fifth wheel.",
    },
  },
  {
    id: "fifth_wheel_hitch",
    label: "Fifth-wheel hitch",
    help: {
      definition: "An in-bed coupling system designed for fifth-wheel RV trailers.",
      example: "A properly rated fifth-wheel hitch mounted in the bed of a pickup.",
    },
  },
  {
    id: "gooseneck",
    label: "Gooseneck ball",
    help: {
      definition: "An in-bed ball coupling used for compatible gooseneck trailers or properly approved configurations.",
      example: "Moving a trailer specifically designed for an in-bed gooseneck-ball connection.",
      clarification: "A gooseneck ball is not automatically interchangeable with every fifth-wheel RV connection.",
    },
  },
  {
    id: "bumper_pull",
    label: "Bumper-pull / weight distribution",
    help: {
      definition: "A receiver-hitch system for conventional travel trailers, sometimes using weight-distribution and sway-control equipment.",
      example: "Towing a bumper-pull travel trailer using a rated weight-distribution hitch.",
    },
  },
  {
    id: "flatbed_trailer",
    label: "Flatbed / equipment trailer",
    help: {
      definition: "A trailer capable of carrying RVs or units that cannot be moved through conventional towing.",
      example: "Loading a non-operational camper onto a suitably rated flatbed trailer.",
    },
  },
  {
    id: "chase_vehicle",
    label: "Escort / chase vehicle",
    help: {
      definition: "An additional support vehicle used when a move requires route assistance, visibility, or specialized coordination.",
      example: "Supporting the movement of an oversized park model where legally required.",
    },
  },
  {
    id: "other",
    label: "Other specialized gear",
    help: {
      definition: "Additional professional equipment used for loading, securement, safety, or uncommon RV configurations.",
      example: "Winches, wheel straps, heavy-duty tie-downs, loading ramps, or specialized adapters.",
      clarification: "Describe this equipment in the additional details field.",
    },
  },
] as const;

export const TRANSPORT_PROVIDER_TYPE_LABELS: Record<string, string> = {
  independent: "Independent transporter / Hotshot driver",
  company: "Transport company / Fleet operator",
  driveaway: "Motorhome drive-away specialist",
  towaway: "Tow-away / Dealership relocator",
  other: "Other specialized transport",
};

export const TRANSPORT_OPERATING_SCOPE_LABELS: Record<string, string> = {
  intrastate: "Intrastate only (within home state)",
  regional: "Regional & multi-state corridors",
  nationwide: "Nationwide / Lower 48",
};

export function transportServiceLabel(id: string): string {
  return TRANSPORT_SERVICE_OPTIONS.find((option) => option.id === id)?.label || "";
}

export function transportEquipmentLabel(id: string): string {
  return TRANSPORT_EQUIPMENT_OPTIONS.find((option) => option.id === id)?.label || "";
}
