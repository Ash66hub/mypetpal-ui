import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface DecorItem {
  id: string;
  name: string;
  category: 'furniture' | 'plant' | 'wall';
  imagePath: string;
  levelRequired: number;
}

export interface DecorInstance {
  id?: number;
  userId: number;
  decorId: string;
  x: number;
  y: number;
  rotation: string;
}

@Injectable({
  providedIn: 'root'
})
export class DecorService {
  private readonly decorItems = signal<DecorItem[]>([
    // Furniture - SE View
    {
      id: 'f1',
      name: 'Bathroom Cabinet',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bathroomCabinetDrawer_SE.png',
      levelRequired: 1
    },
    {
      id: 'f3',
      name: 'Bathroom Sink',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bathroomSink_SE.png',
      levelRequired: 1
    },
    {
      id: 'f5',
      name: 'Single Bed',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bedSingle_SE.png',
      levelRequired: 1
    },
    {
      id: 'f7',
      name: 'Bench',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bench_SE.png',
      levelRequired: 1
    },
    {
      id: 'f9',
      name: 'Chair with Cushion',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/chairCushion_SE.png',
      levelRequired: 1
    },
    {
      id: 'f11',
      name: 'Standard Chair',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/chair_SE.png',
      levelRequired: 1
    },
    {
      id: 'f15',
      name: 'Kitchen Sink',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/kitchenSink_SE.png',
      levelRequired: 6
    },
    {
      id: 'f17',
      name: 'Kitchen Stove',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/kitchenStove_SE.png',
      levelRequired: 8
    },
    {
      id: 'f19',
      name: 'Lounge Sofa Corner',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/loungeSofaCorner_SE.png',
      levelRequired: 4
    },
    {
      id: 'f21',
      name: 'Lounge Sofa',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/loungeSofa_SE.png',
      levelRequired: 4
    },
    {
      id: 'f23',
      name: 'Shower',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/shower_SE.png',
      levelRequired: 10
    },
    {
      id: 'f25',
      name: 'Side Table',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/sideTableDrawers_SE.png',
      levelRequired: 1
    },
    {
      id: 'f27',
      name: 'Speaker',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/speaker_SE.png',
      levelRequired: 2
    },
    {
      id: 'f29',
      name: 'Television',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/TV_SE.png',
      levelRequired: 3
    },
    {
      id: 'f31',
      name: 'Bathtub',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bathtub_SE.png',
      levelRequired: 6
    },
    {
      id: 'f33',
      name: 'Modern Cushion Chair',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/chairModernCushion_SE.png',
      levelRequired: 5
    },
    {
      id: 'f35',
      name: 'Rounded Chair',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/chairRounded_SE.png',
      levelRequired: 4
    },
    {
      id: 'f37',
      name: 'Electric Stove',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/kitchenStoveElectric_SE.png',
      levelRequired: 9
    },
    {
      id: 'f39',
      name: 'Floor Lamp',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/lampRoundFloor_SE.png',
      levelRequired: 2
    },
    {
      id: 'f41',
      name: 'Design Lounge Chair',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/loungeDesignChair_SE.png',
      levelRequired: 7
    },
    {
      id: 'f43',
      name: 'Design Lounge Sofa',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/loungeDesignSofa_SE.png',
      levelRequired: 8
    },
    {
      id: 'f45',
      name: 'Lounge Ottoman',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/loungeSofaOttoman_SE.png',
      levelRequired: 6
    },
    {
      id: 'f47',
      name: 'Round Shower',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/showerRound_SE.png',
      levelRequired: 11
    },
    {
      id: 'f49',
      name: 'Square Glass Coffee Table',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/tableCoffeeGlassSquare_SE.png',
      levelRequired: 5
    },
    {
      id: 'f51',
      name: 'Coffee Table',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/tableCoffeeSquare_SE.png',
      levelRequired: 3
    },
    {
      id: 'f53',
      name: 'Square Toilet',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/toiletSquare_SE.png',
      levelRequired: 4
    },
    {
      id: 'f55',
      name: 'Trash Can',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/trashcan_SE.png',
      levelRequired: 1
    },
    {
      id: 'f57',
      name: 'Stacked Washer Dryer',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/washerDryerStacked_SE.png',
      levelRequired: 7
    },
    {
      id: 'f59',
      name: 'Washer',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/washer_SE.png',
      levelRequired: 5
    },
    {
      id: 'f61',
      name: 'Double Bed',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bedDouble_SE.png',
      levelRequired: 5
    },
    {
      id: 'f63',
      name: 'Closed Bookcase',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bookcaseClosedDoors_SE.png',
      levelRequired: 3
    },
    {
      id: 'f65',
      name: 'Open Bookcase',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/bookcaseOpen_SE.png',
      levelRequired: 3
    },
    {
      id: 'f67',
      name: 'Desk Chair',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/chairDesk_SE.png',
      levelRequired: 2
    },
    {
      id: 'f69',
      name: 'Standing Coat Rack',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/coatRackStanding_SE.png',
      levelRequired: 1
    },
    {
      id: 'f71',
      name: 'Desk',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/desk_SE.png',
      levelRequired: 2
    },
    {
      id: 'f73',
      name: 'Refrigerator',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/kitchenFridge_SE.png',
      levelRequired: 4
    },
    {
      id: 'f75',
      name: 'Square Floor Lamp',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/lampSquareFloor_SE.png',
      levelRequired: 2
    },
    {
      id: 'f77',
      name: 'Rectangle Rug',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/rugRectangle_SE.png',
      levelRequired: 1
    },
    {
      id: 'f79',
      name: 'Round Rug',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/rugRound_SE.png',
      levelRequired: 1
    },
    {
      id: 'f81',
      name: 'Rounded Rug',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/rugRounded_SE.png',
      levelRequired: 1
    },
    {
      id: 'f83',
      name: 'Square Rug',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/rugSquare_SE.png',
      levelRequired: 1
    },
    {
      id: 'f85',
      name: 'Square Bar Stool',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/stoolBarSquare_SE.png',
      levelRequired: 3
    },
    {
      id: 'f87',
      name: 'Bar Stool',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/stoolBar_SE.png',
      levelRequired: 3
    },
    {
      id: 'f89',
      name: 'Glass Coffee Table',
      category: 'furniture',
      imagePath: 'assets/decor/furniture/tableCoffeeGlass_SE.png',
      levelRequired: 4
    },

    // Plants
    {
      id: 'p1',
      name: 'Potted Plant',
      category: 'plant',
      imagePath: 'assets/decor/plant/pottedPlant_SE.png',
      levelRequired: 1
    },
    {
      id: 'p3',
      name: 'Small Plant 1',
      category: 'plant',
      imagePath: 'assets/decor/plant/plantSmall1_SE.png',
      levelRequired: 1
    },
    {
      id: 'p5',
      name: 'Small Plant 2',
      category: 'plant',
      imagePath: 'assets/decor/plant/plantSmall2_SE.png',
      levelRequired: 1
    },
    {
      id: 'p7',
      name: 'Small Plant 3',
      category: 'plant',
      imagePath: 'assets/decor/plant/plantSmall3_SE.png',
      levelRequired: 1
    },

    // Walls
    {
      id: 'w3',
      name: 'Wall Half',
      category: 'wall',
      imagePath: 'assets/decor/wall/wallHalf_SE.png',
      levelRequired: 1
    },
    {
      id: 'w5',
      name: 'Wall Window',
      category: 'wall',
      imagePath: 'assets/decor/wall/wallWindow_SE.png',
      levelRequired: 1
    },
    {
      id: 'w7',
      name: 'Solid Wall',
      category: 'wall',
      imagePath: 'assets/decor/wall/wall_SE.png',
      levelRequired: 1
    },
    {
      id: 'w9',
      name: 'Doorway',
      category: 'wall',
      imagePath: 'assets/decor/wall/doorway_SE.png',
      levelRequired: 2
    },
    {
      id: 'w11',
      name: 'Open Doorway',
      category: 'wall',
      imagePath: 'assets/decor/wall/doorwayOpen_SE.png',
      levelRequired: 2
    },
    {
      id: 'w13',
      name: 'Sliding Wall Window',
      category: 'wall',
      imagePath: 'assets/decor/wall/wallWindowSlide_SE.png',
      levelRequired: 3
    }
  ]);

  private apiUrl = environment.apiUrl + 'decor';

  constructor(private http: HttpClient) {}

  public items = this.decorItems.asReadonly();
  public activeCounts = signal<Record<string, number>>({});
  public isRoomLoaded = signal<boolean>(false);

  // Updated from GameComponent using real level data.
  public userLevel = signal<number>(5);

  public getItemsByCategory(
    category: 'furniture' | 'plant' | 'wall'
  ): DecorItem[] {
    return this.decorItems().filter(item => item.category === category);
  }

  public isItemLocked(item: DecorItem): boolean {
    return item.levelRequired > this.userLevel();
  }

  public getSavedDecor(userId: number): Observable<DecorInstance[]> {
    return this.http.get<DecorInstance[]>(`${this.apiUrl}?userId=${userId}`);
  }

  public saveDecor(
    userId: number,
    instances: DecorInstance[]
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}?userId=${userId}`, instances);
  }

  public getLimitForItem(item: DecorItem): number {
    if (item.category === 'wall') {
      return item.id === 'w7' || item.id === 'w3' ? 50 : 20;
    }
    return 10;
  }
}
