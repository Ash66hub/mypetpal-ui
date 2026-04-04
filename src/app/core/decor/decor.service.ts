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
}
