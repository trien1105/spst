import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Compass,
  Award,
  AlertTriangle,
  BookOpen,
  MapPin,
  Flag,
  HelpCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  Star,
  CheckCircle2,
  XCircle,
  Radio,
  Scroll,
  Footprints,
  Sparkles,
  Maximize2,
  Minimize2,
  Menu,
  ChevronRight,
  ShieldAlert,
  Flame,
  Info,
  Map as MapIcon,
  Navigation,
  Eye,
  DoorOpen,
  DoorClosed,
  ZoomIn,
  ZoomOut,
  Trophy,
  QrCode,
  Users,
  Play,
  StopCircle,
  RefreshCw,
  Crown,
  Copy,
  Check,
  Timer,
  User,
  Edit3
} from 'lucide-react';

// =========================================================================
// 1. ÂM THANH SYNTHESIZER (WEB AUDIO API THUẦN)
// =========================================================================
class SoundEngine {
  static ctx = null;
  static enabled = true;

  static init() {
    if (!SoundEngine.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) SoundEngine.ctx = new AudioCtx();
    }
  }

  static playTone(freq = 440, type = 'sine', duration = 0.12, gainVal = 0.08) {
    if (!SoundEngine.enabled) return;
    try {
      SoundEngine.init();
      if (!SoundEngine.ctx) return;
      if (SoundEngine.ctx.state === 'suspended') SoundEngine.ctx.resume();
      const osc = SoundEngine.ctx.createOscillator();
      const gain = SoundEngine.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, SoundEngine.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, SoundEngine.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, SoundEngine.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(SoundEngine.ctx.destination);
      osc.start();
      osc.stop(SoundEngine.ctx.currentTime + duration);
    } catch {}
  }

  static step() {
    SoundEngine.playTone(160, 'triangle', 0.035, 0.016);
  }
  static interact() {
    SoundEngine.playTone(540, 'sine', 0.1, 0.06);
  }
  static warp() {
    SoundEngine.playTone(380, 'sine', 0.12, 0.06);
    setTimeout(() => SoundEngine.playTone(520, 'sine', 0.12, 0.07), 80);
    setTimeout(() => SoundEngine.playTone(740, 'triangle', 0.2, 0.09), 160);
  }
  static collect() {
    SoundEngine.playTone(659.25, 'triangle', 0.1, 0.08);
    setTimeout(() => SoundEngine.playTone(880, 'triangle', 0.2, 0.1), 90);
  }
  static alert() {
    SoundEngine.playTone(240, 'sawtooth', 0.15, 0.1);
  }
  static success() {
    SoundEngine.playTone(523.25, 'triangle', 0.15, 0.09);
    setTimeout(() => SoundEngine.playTone(659.25, 'triangle', 0.15, 0.09), 110);
    setTimeout(() => SoundEngine.playTone(783.99, 'triangle', 0.25, 0.11), 220);
  }
  static wrong() {
    SoundEngine.playTone(210, 'sawtooth', 0.22, 0.12);
  }
  static victory() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => SoundEngine.playTone(f, 'triangle', 0.35, 0.12), i * 160);
    });
  }
}

// =========================================================================
// 2. KÍCH THƯỚC BẢN ĐỒ TỪNG MAP (32 x 24 TILES, 48x48 MỖI TILE)
// =========================================================================
const TILE_SIZE = 48;
const MAP_WIDTH = 32;
const MAP_HEIGHT = 24;

// BÁN KÍNH VÒNG TRÒN CẢNH BÁO MẬT THÁM PHÁP (ĐÃ ĐƯỢC THU NHỎ GỌN GÀNG THEO YÊU CẦU)
const PATROL_VISUAL_RADIUS = 2.2; // Bán kính vòng tròn đỏ vẽ trên map = 2.2 ô (105.6px)
const PATROL_DETECT_RADIUS = 2.0; // Bán kính kích hoạt phát hiện = 2.0 ô (96.0px, có biên an toàn 0.2 ô cho người chơi)

// Kích thước hiển thị nhân vật to rõ (HD Chibi scaling)
const CHAR_WIDTH = 58;
const CHAR_HEIGHT = 76;

const TILES = {
  GRASS: 0,
  PATH: 1,
  MUSEUM_FLOOR: 2,
  FOREST: 3,
  WATER: 4,
  ROCKY: 5,
  GRASS_PLAZA: 6
};

// =========================================================================
// 3. CƠ SỞ DỮ LIỆU TOÀN DIỆN VĂN KIỆN & 18 NHÂN VẬT CON ĐƯỜNG ĐỘC LẬP (35+ CÂU HỎI)
// =========================================================================
const HISTORICAL_DIRECTIVES = [
  { id: 'DIR_1930_CUONGLINH', title: 'Cương lĩnh chính trị đầu tiên', year: 1930, author: 'Nguyễn Ái Quốc', desc: 'Độc lập dân tộc gắn liền với Chủ nghĩa Xã hội' },
  { id: 'DIR_1930_LUANCUONG', title: 'Luận cương chính trị tháng 10', year: 1930, author: 'Trần Phú', desc: 'Sứ mệnh lịch sử của giai cấp công nhân và liên minh công nông' },
  { id: 'DIR_1935_DAIHOI1', title: 'Nghị quyết Đại hội Đảng lần I', year: 1935, author: 'Lê Hồng Phong', desc: 'Khôi phục toàn diện hệ thống tổ chức Đảng sau khủng bố trắng' },
  { id: 'DIR_1936_DANCHU', title: 'Nghị quyết Mặt trận Dân chủ', year: 1936, author: 'Hà Huy Tập', desc: 'Đấu tranh đòi tự do, dân chủ, cơm áo, hòa bình' },
  { id: 'DIR_1939_TUCHITRICH', title: 'Tác phẩm "Tự chỉ trích" & NQ TW6', year: 1939, author: 'Nguyễn Văn Cừ', desc: 'Đặt nhiệm vụ giải phóng dân tộc lên hàng đầu' },
  { id: 'DIR_1941_TW8', title: 'Nghị quyết TW 8 Pác Bó', year: 1941, author: 'Hồ Chí Minh', desc: 'Thành lập Mặt trận Việt Minh giải phóng dân tộc' },
  { id: 'DIR_1944_VNTTGPQ', title: 'Chỉ thị thành lập Đội VNTTGPQ', year: 1944, author: 'Hồ Chí Minh & Võ Nguyên Giáp', desc: 'Chính trị trọng hơn quân sự, tiền thân Quân đội Nhân dân' },
  { id: 'DIR_1945_QUANLENH1', title: 'Quân lệnh số 1 Toàn quốc Khởi nghĩa', year: 1945, author: 'Trường Chinh & Ban Khởi nghĩa', desc: 'Phát động Tổng khởi nghĩa Tháng Tám giành chính quyền' }
];

const ALL_HISTORICAL_NPCS = {
  NPC_ANH: {
    id: 'NPC_ANH',
    name: "Anh",
    role: "Đội trưởng Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 6,
    y: 6,
    spriteKey: 'npcAnh',
    directiveKey: 'null',
    questions: [
      {
        question: "Chào bạn! Để mở đầu hành trình Con đường Độc lập (1930 – 1945), bạn hãy nêu rõ: Dưới ách thống trị của thực dân Pháp, xã hội Việt Nam tồn tại hai mâu thuẫn cơ bản nào?",
        options: [
          {
            text: "A. Mâu thuẫn giữa tư sản dân tộc với thực dân Pháp; và mâu thuẫn giữa trí thức tiểu tư sản với phong kiến tay sai.",
            isCorrect: false,
            feedback: "Chưa chính xác! Đây là các tầng lớp trung gian, không phải mâu thuẫn cơ bản nhất bao trùm toàn xã hội thuộc địa.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Mâu thuẫn giữa toàn thể dân tộc Việt Nam với thực dân Pháp xâm lược; và mâu thuẫn giữa nhân dân lao động (chủ yếu là nông dân) với địa chủ phong kiến.",
            isCorrect: true,
            feedback: "Chính xác! Trong đó, mâu thuẫn giữa toàn thể dân tộc Việt Nam với thực dân Pháp xâm lược là mâu thuẫn chủ yếu và gay gắt nhất.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Mâu thuẫn thuần túy giữa giai cấp công nhân với các chủ xưởng tư bản thực dân Pháp.",
            isCorrect: false,
            feedback: "Chưa đầy đủ! Việt Nam là một xã hội thuộc địa nửa phong kiến với nông dân chiếm trên 90% dân số.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Mâu thuẫn tranh giành quyền lực giữa các phe phái phong kiến triều đình nhà Nguyễn.",
            isCorrect: false,
            feedback: "Sai lầm! Triều đình phong kiến nhà Nguyễn lúc này đã đầu hàng và hoàn toàn câu kết làm tay sai cho giặc Pháp.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Chính sách khai thác thuộc địa của thực dân Pháp đã làm phân hóa giai cấp xã hội sâu sắc. Giai cấp nào vừa mới ra đời đã sớm tiếp thu chủ nghĩa Mác - Lênin và nắm quyền lãnh đạo cách mạng?",
        options: [
          {
            text: "A. Giai cấp Nông dân - vì chiếm số lượng đông đảo nhất và giàu truyền thống yêu nước chống ngoại xâm.",
            isCorrect: false,
            feedback: "Chưa đúng! Nông dân là lực lượng quân đội cách mạng hùng hậu nhất, nhưng không có hệ tư tưởng độc lập để lãnh đạo.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Giai cấp Tư sản dân tộc - vì có tiềm lực kinh tế và học thức tân tiến từ phương Tây.",
            isCorrect: false,
            feedback: "Sai! Tư sản dân tộc Việt Nam số lượng nhỏ bé, yếu ớt về kinh tế và dễ thỏa hiệp với thực dân.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Giai cấp Công nhân - đại diện cho phương thức sản xuất tiên tiến, có tinh thần kỷ luật và triệt để cách mạng.",
            isCorrect: true,
            feedback: "Rất chính xác! Giai cấp công nhân Việt Nam ra đời trước tư sản dân tộc, chịu 3 tầng áp bức bóc lột nên có ý chí cách mạng kiên định và triệt để nhất.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Tầng lớp Trí thức tiểu tư sản - vì có khả năng tiếp cận nhanh với sách báo và tư tưởng dân chủ cấp tiến.",
            isCorrect: false,
            feedback: "Chưa đúng! Trí thức tiểu tư sản đóng vai trò ngòi nổ thức tỉnh, nhưng dễ dao động, không thể là giai cấp lãnh đạo.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_BINH: {
    id: 'NPC_BINH',
    name: "Bình",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 16,
    y: 4,
    spriteKey: 'npcBinh',
    directiveKey: 'null',
    questions: [
      {
        question: "Trước khi Đảng ra đời, các sĩ phu yêu nước tiền bối đã dấy lên phong trào cứu nước vẻ vang. Hai xu hướng cứu nước tiêu biểu đầu thế kỷ XX gắn liền với Phan Bội Châu và Phan Châu Trinh là gì?",
        options: [
          {
            text: "A. Xu hướng Khởi nghĩa vũ trang Cần Vương và xu hướng Đấu tranh nghị trường bảo hoàng.",
            isCorrect: false,
            feedback: "Chưa đúng! Phong trào Cần Vương thuộc hệ tư tưởng phong kiến cuối thế kỷ XIX.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Xu hướng Thành lập công đoàn đỏ và xu hướng Hợp tác xã tương tế công nông.",
            isCorrect: false,
            feedback: "Sai! Đây là các hình thức tổ chức của phong trào công nhân sau khi có ánh sáng cách mạng vô sản.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Xu hướng Cải lương lập hiến phối hợp quân sự với các cường quốc phương Tây.",
            isCorrect: false,
            feedback: "Chưa chính xác! Cả hai cụ Phan đều hướng theo tư tưởng dân chủ tư sản Á Đông chứ không chủ trương lập hiến phương Tây.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Xu hướng Bạo động cách mạng (Phan Bội Châu - Đông Du) và xu hướng Cải cách duy tân (Phan Châu Trinh - Duy Tân).",
            isCorrect: true,
            feedback: "Rất chính xác! Cụ Phan Bội Châu chủ trương bạo động dựa vào Nhật (Đông Du), còn cụ Phan Châu Trinh chủ trương khai dân trí, chấn dân khí, hậu dân sinh (Duy Tân).",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Nguyên nhân căn bản dẫn đến sự thất bại của các phong trào yêu nước cuối thế kỷ XIX - đầu thế kỷ XX theo ngọn cờ phong kiến và tư sản là gì?",
        options: [
          {
            text: "A. Khủng hoảng sâu sắc về đường lối cứu nước và thiếu giai cấp lãnh đạo tiên tiến đủ sức đưa cách mạng đến thắng lợi.",
            isCorrect: true,
            feedback: "Hoàn toàn chính xác! Hệ tư tưởng phong kiến và tư sản đã lỗi thời, không giải quyết được yêu cầu độc lập dân tộc và giải phóng giai cấp.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Nhân dân Việt Nam lúc đó chưa có tinh thần yêu nước và chưa sẵn sàng hy sinh đánh giặc.",
            isCorrect: false,
            feedback: "Hoàn toàn sai! Tinh thần yêu nước và ý chí bất khuất của nhân dân ta luôn sục sôi ở bất kỳ thời kỳ nào.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Do các nước láng giềng can thiệp quân sự ủng hộ thực dân Pháp đàn áp.",
            isCorrect: false,
            feedback: "Không đúng! Nguyên nhân quyết định nằm ở đường lối và ngọn cờ lãnh đạo nội tại của phong trào.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Do vũ khí trang bị thô sơ hoàn toàn không thể chống lại hỏa lực đại bác của thực dân.",
            isCorrect: false,
            feedback: "Chưa chuẩn xác! Vũ khí là yếu tố quan trọng nhưng đường lối cách mạng đúng đắn mới là nhân tố quyết định.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_LINH: {
    id: 'NPC_LINH',
    name: "Linh",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 26,
    y: 5,
    spriteKey: 'npcLinh',
    directiveKey: 'null',
    questions: [
      {
        question: "Ngày 5/6/1911, người thanh niên Nguyễn Tất Thành rời bến cảng Nhà Rồng ra đi tìm đường cứu nước trên con tàu nào?",
        options: [
          {
            text: "A. Tàu tuần dương hạm De La Grandière của hải quân Pháp.",
            isCorrect: false,
            feedback: "Sai! De La Grandière là tàu chiến của thực dân Pháp xâm lược cuối thế kỷ XIX.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Tàu buôn Đô đốc Latouche-Tréville của hãng vận tải Hợp thành Năm Sao (Pháp).",
            isCorrect: true,
            feedback: "Chính xác! Người thanh niên Nguyễn Tất Thành với tên gọi Văn Ba đã làm phụ bếp trên con tàu này để bôn ba khắp năm châu tìm chân lý cứu quốc.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Tàu khách Amiral Courbet chạy tuyến thương mại Viễn Đông - Marseille.",
            isCorrect: false,
            feedback: "Sai! Đây không phải con tàu lịch sử gắn với hành trình ngày 5/6/1911.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Tàu bọc thép Armand Rousseau thuộc hạm đội Pháp đóng tại Sài Gòn.",
            isCorrect: false,
            feedback: "Không chính xác! Con tàu mang tên Đô đốc Latouche-Tréville.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Tháng 7/1920, khi đọc bản 'Sơ thảo Luận cương về vấn đề dân tộc và vấn đề thuộc địa' của V.I.Lênin đăng trên báo L'Humanité, Nguyễn Ái Quốc đã tìm thấy điều cốt yếu gì?",
        options: [
          {
            text: "A. Kế hoạch kêu gọi viện trợ vũ khí và tài chính từ các chính phủ tư bản phương Tây.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Lênin và Quốc tế Cộng sản phê phán gay gắt sự bóc lột của chủ nghĩa tư bản đế quốc đối với các thuộc địa.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Phương pháp cải cách văn hóa giáo dục hòa bình dưới sự bảo trợ của Hội Quốc Liên.",
            isCorrect: false,
            feedback: "Sai lầm! Luận cương của Lênin vạch rõ con đường đấu tranh cách mạng bạo lực đánh đổ chủ nghĩa thực dân.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Con đường giải phóng dân tộc gắn liền với giải phóng giai cấp theo quỹ đạo cách mạng vô sản.",
            isCorrect: true,
            feedback: "Chính xác tuyệt đối! Người xúc động thốt lên: 'Hỡi đồng bào bị đọa đày đau khổ! Đây là cái cần thiết cho chúng ta, đây là con đường giải phóng chúng ta!'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Lệnh điều động quân đội viễn chinh của nước Nga Xô viết sang hỗ trợ Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Lênin chỉ rõ các dân tộc bị áp bức phải tự vùng lên tự giải phóng lấy vận mệnh của mình.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_NGOC: {
    id: 'NPC_NGOC',
    name: "Ngọc",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 22,
    y: 10,
    spriteKey: 'npcNgoc',
    directiveKey: 'null',
    questions: [
      {
        question: "Tháng 6/1925, tại Quảng Châu (Trung Quốc), Nguyễn Ái Quốc thành lập tổ chức tiền thân nào chuẩn bị về chính trị, tư tưởng và tổ chức cho việc thành lập Đảng?",
        options: [
          {
            text: "A. Tâm tâm xã - tổ chức yêu nước tiến bộ ám sát toàn quyền Merlin.",
            isCorrect: false,
            feedback: "Chưa đúng! Tâm tâm xã là hạt nhân ban đầu, từ đó Nguyễn Ái Quốc chọn lọc và giác ngộ để lập nên Hội VNCM Thanh niên.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Việt Nam Quốc dân Đảng - theo xu hướng dân chủ tư sản của Nguyễn Thái Học.",
            isCorrect: false,
            feedback: "Sai! Việt Nam Quốc dân Đảng thành lập năm 1927 tại Bắc Kỳ theo khuynh hướng cách mạng tư sản.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Tân Việt Cách mạng Đảng - tổ chức của nhóm trí thức thanh niên yêu nước Trung Kỳ.",
            isCorrect: false,
            feedback: "Không đúng! Tân Việt hoạt động ở Trung Kỳ và sau này tiếp thu tư tưởng của Hội VNCM Thanh niên để chuyển hóa.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Hội Việt Nam Cách mạng Thanh niên (với nòng cốt là Cộng sản Đoàn).",
            isCorrect: true,
            feedback: "Rất chính xác! Hội Việt Nam Cách mạng Thanh niên đã mở các lớp huấn luyện cán bộ, ra tuần báo Thanh niên truyền bá chủ nghĩa Mác - Lênin về nước.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Tác phẩm lý luận chính trị 'Đường Kách mệnh' (1927) của Nguyễn Ái Quốc có vai trò lịch sử trọng đại nào đối với phong trào cách mạng Việt Nam?",
        options: [
          {
            text: "A. Cuốn sách giáo khoa chính trị đầu tiên truyền bá chủ nghĩa Mác - Lênin, chỉ rõ bản chất cách mạng và trang bị lý luận cho các chiến sĩ cộng sản.",
            isCorrect: true,
            feedback: "Chính xác! Tác phẩm nhấn mạnh cốt lõi: 'Cách mệnh trước hết phải có Đảng cách mệnh... Đảng có vững cách mệnh mới thành công'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Tuyển tập văn học trào phúng tố cáo chế độ thuế khóa hà khắc của quan lại triều đình Huế.",
            isCorrect: false,
            feedback: "Sai! 'Bản án chế độ thực dân Pháp' (1925) mới là tác phẩm chính luận đanh thép tố cáo tội ác thực dân Pháp xuất bản ở Paris.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Bản hiệp ước liên minh quân sự giữa phong trào cứu quốc Việt Nam và Quốc dân Đảng Trung Hoa.",
            isCorrect: false,
            feedback: "Sai lầm! Tác phẩm vạch rõ lập trường độc lập của giai cấp công nông, kiên quyết đi theo con đường Cách mạng Tháng Mười Nga.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Văn bản chỉ thị phát động cuộc tổng đình công kinh tế toàn quốc đòi tăng lương giảm giờ làm.",
            isCorrect: false,
            feedback: "Chưa đúng! Đây là tác phẩm lý luận toàn diện về chiến lược cách mạng giải phóng dân tộc chứ không phải chỉ thị bãi công.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_DUNG: {
    id: 'NPC_DUNG',
    name: "Dũng",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 26,
    y: 19,
    spriteKey: 'npcDung',
    directiveKey: 'null',
    questions: [
      {
        question: "Phong trào 'Vô sản hóa' cuối năm 1928 của Hội Việt Nam Cách mạng Thanh niên có ý nghĩa bước ngoặt thế nào?",
        options: [
          {
            text: "A. Cử các thanh niên ưu tú xuất dương sang các nước tư bản học tập kỹ thuật công nghiệp hiện đại.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Vô sản hóa là chủ trương đưa hội viên thâm nhập thực tế vào đời sống công nông trong nước.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Đưa cán bộ thâm nhập vào các nhà máy, đồn điền, hầm mỏ để rèn luyện, truyền bá chủ nghĩa Mác - Lênin và thúc đẩy phong trào công nhân chuyển sang tự giác.",
            isCorrect: true,
            feedback: "Rất chính xác! Cán bộ cách mạng 'cùng ăn, cùng ở, cùng làm việc' với thợ thuyền, đưa lý luận Mác - Lênin gắn kết chặt chẽ với thực tiễn đấu tranh giai cấp.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Vận động giới tư sản dân tộc đóng góp tài chính mua lại các xí nghiệp của tư bản Pháp.",
            isCorrect: false,
            feedback: "Không đúng! Đây là phong trào rèn luyện lập trường giai cấp vô sản chứ không phải chính sách tài chính.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Tổ chức lực lượng vũ trang tấn công phá hủy các đồn bốt biên phòng thuộc địa.",
            isCorrect: false,
            feedback: "Sai! Năm 1928 là thời kỳ chuẩn bị cơ sở chính trị quần chúng, chưa phải thời điểm khởi nghĩa vũ trang.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Sự kiện bãi công của công nhân Ba Son (Sài Gòn, 8/1925) do Tôn Đức Thắng lãnh đạo đánh dấu bước ngoặt gì của phong trào công nhân Việt Nam?",
        options: [
          {
            text: "A. Lực lượng công nhân đã hoàn toàn đánh đuổi thực dân Pháp và làm chủ Sài Gòn - Chợ Lớn.",
            isCorrect: false,
            feedback: "Sai! Năm 1925 chưa có khởi nghĩa giành chính quyền đô thị.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Lần đầu tiên công nhân sử dụng vũ khí hỏa lực hiện đại tiêu diệt binh lính đồn trú tại bến cảng.",
            isCorrect: false,
            feedback: "Sai! Cuộc bãi công diễn ra bằng hình thức đấu tranh kinh tế - kỹ thuật kết hợp mục tiêu chính trị mưu trí.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Đánh dấu phong trào công nhân Việt Nam bước đầu chuyển từ đấu tranh tự phát sang đấu tranh tự giác, mang tính quốc tế vô sản.",
            isCorrect: true,
            feedback: "Chính xác! Cuộc bãi công giữ tàu chiến Jules Michelet chậm tiến độ sửa chữa để ngăn chặn việc đàn áp cách mạng Trung Quốc, biểu dương tình đoàn kết vô sản quốc tế.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Khởi đầu cho xu hướng thỏa hiệp nghị trường nhằm xin ân giảm án phạt của chính quyền thực dân.",
            isCorrect: false,
            feedback: "Hoàn toàn sai! Bãi công Ba Son thể hiện tinh thần đấu tranh giai cấp kiên quyết và độc lập chính trị.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_KHANH: {
    id: 'NPC_KHANH',
    name: "Khánh",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 16,
    y: 20,
    spriteKey: 'npcKhanh',
    directiveKey: 'null',
    questions: [
      {
        question: "Năm 1929, tại Việt Nam lần lượt ra đời ba tổ chức cộng sản nào?",
        options: [
          {
            text: "A. Hội Việt Nam Cách mạng Thanh niên, Tâm tâm xã và Đảng Lập hiến Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Đây là các tổ chức thuộc các giai đoạn và khuynh hướng tư tưởng hoàn toàn khác nhau.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Việt Nam Quốc dân Đảng, Tân Việt Cách mạng Đảng và Việt Nam Phục quốc Đồng minh Hội.",
            isCorrect: false,
            feedback: "Sai! Đây không phải là ba tổ chức cộng sản ra đời trong năm 1929.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Đông Dương Cộng sản Liên đoàn, Mặt trận Dân chủ Đông Dương và Việt Nam Độc lập Đồng minh.",
            isCorrect: false,
            feedback: "Chưa đúng! Mặt trận Dân chủ thành lập năm 1938, Mặt trận Việt Minh thành lập tháng 5/1941.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Đông Dương Cộng sản Đảng (6/1929), An Nam Cộng sản Đảng (11/1929) và Đông Dương Cộng sản Liên đoàn (1/1930).",
            isCorrect: true,
            feedback: "Rất chính xác! Sự ra đời dồn dập của 3 tổ chức cộng sản năm 1929 khẳng định xu thế phát triển tất yếu của phong trào cách mạng vô sản Việt Nam.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Tình trạng ba tổ chức cộng sản hoạt động tranh giành ảnh hưởng lẫn nhau năm 1929 đặt ra yêu cầu cấp bách nào?",
        options: [
          {
            text: "A. Phải lập tức thống nhất các tổ chức cộng sản lại thành một chính đảng duy nhất để thống nhất lãnh đạo cách mạng toàn quốc.",
            isCorrect: true,
            feedback: "Hoàn toàn chính xác! Đồng chí Nguyễn Ái Quốc với tư cách phái viên Quốc tế Cộng sản đã kịp thời triệu tập Hội nghị hợp nhất vào đầu năm 1930.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Tuyên bố giải tán cả ba tổ chức và chuyển hướng sang ủng hộ khởi nghĩa Yên Bái của Việt Nam Quốc dân Đảng.",
            isCorrect: false,
            feedback: "Sai lầm! Lập trường của những người cộng sản là độc lập giai cấp, kiên trì ngọn cờ vô sản.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Tiếp tục chờ đợi nghị quyết chỉ đạo trực tiếp từ trụ sở Quốc tế Cộng sản tại Moscow.",
            isCorrect: false,
            feedback: "Sai! Thực tiễn đòi hỏi tinh thần chủ động, sáng tạo và quyết đoán của lãnh tụ Nguyễn Ái Quốc.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Chia ba tổ chức cai quản biệt lập theo ba kỳ: Bắc Kỳ, Trung Kỳ và Nam Kỳ để tránh xung đột.",
            isCorrect: false,
            feedback: "Sai! Chia rẽ địa bàn sẽ làm phân tán lực lượng và suy yếu nghiêm trọng sự chỉ đạo cách mạng toàn quốc.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_DUC: {
    id: 'NPC_DUC',
    name: "Đức",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 6,
    y: 19,
    spriteKey: 'npcDuc',
    directiveKey: 'null',
    questions: [
      {
        question: "Hội nghị hợp nhất thành lập Đảng diễn ra từ ngày 6/1/1930 tại Cửu Long (Hương Cảng, Trung Quốc) do ai chủ trì?",
        options: [
          {
            text: "A. Đồng chí Trần Phú - Tổng Bí thư đầu tiên của Ban Chấp hành Trung ương Đảng.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Trần Phú lúc này đang hoàn thành khóa học ở Liên Xô và trở về nước vào tháng 4/1930.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Đồng chí Nguyễn Ái Quốc - đại diện phái viên có đầy đủ quyền quyết định của Quốc tế Cộng sản.",
            isCorrect: true,
            feedback: "Chính xác! Bằng uy tín đạo đức cách mạng cao cả và sự sáng suốt phi thường, Người đã hợp nhất các tổ chức cộng sản thành một khối gang thép.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Đồng chí Lê Hồng Phong - Ủy viên Ban Chấp hành Quốc tế Cộng sản phụ trách Viễn Đông.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Lê Hồng Phong tham gia ban chỉ đạo ở hải ngoại thời kỳ sau này.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Đồng chí Ngô Gia Tự - đại biểu ưu tú của Đông Dương Cộng sản Đảng.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Ngô Gia Tự là lãnh đạo Đông Dương Cộng sản Đảng nhưng người triệu tập và chủ trì là Nguyễn Ái Quốc.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Hội nghị thành lập Đảng đầu năm 1930 đã quyết định lấy tên chính đảng là gì theo đề nghị của Nguyễn Ái Quốc?",
        options: [
          {
            text: "A. Đảng Cộng sản Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Tên Đảng Cộng sản Đông Dương được thông qua tại Hội nghị Trung ương tháng 10/1930 do Trần Phú chủ trì.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Hội Lao động Xã hội Chủ nghĩa Việt Nam.",
            isCorrect: false,
            feedback: "Sai! Không có tổ chức nào mang tên như vậy tại Hội nghị hợp nhất.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Đảng Cộng sản Việt Nam.",
            isCorrect: true,
            feedback: "Rất chính xác! Tên gọi thể hiện tinh thần dân tộc sâu sắc, tự hào và đáp ứng trọn vẹn ý chí, nguyện vọng của các tầng lớp nhân dân Việt Nam.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Đảng Dân chủ Xã hội Việt Nam.",
            isCorrect: false,
            feedback: "Sai! Đảng ta được tổ chức theo nguyên tắc chính đảng vô sản mác-xít chứ không theo đường lối dân chủ xã hội tư sản.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_HUNG: {
    id: 'NPC_HUNG',
    name: "Hùng",
    role: "Chiến sĩ Đội Tiên phong",
    mapId: 'MAP_QUANGTRUONG',
    x: 4,
    y: 12,
    spriteKey: 'npcHung',
    directiveKey: 'DIR_1930_CUONGLINH',
    directiveTitle: "Cương lĩnh chính trị đầu tiên (2/1930) — Nguyễn Ái Quốc",
    directiveYear: 1930,
    questions: [
      {
        question: "Cương lĩnh chính trị đầu tiên do Nguyễn Ái Quốc khởi thảo thông qua tại Hội nghị thành lập Đảng (1930) xác định phương hướng chiến lược của cách mạng Việt Nam là gì?",
        options: [
          {
            text: "A. Vận động cải lương xin chính phủ thuộc địa Pháp ban bố quyền tự do lập hội và tự do xuất bản báo chí.",
            isCorrect: false,
            feedback: "Sai lầm! Cương lĩnh xác định bạo lực cách mạng là con đường đánh đổ ách thống trị thực dân phong kiến.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Tiến hành ngay lập tức cách mạng xã hội chủ nghĩa, tịch thu triệt để mọi cơ sở kinh doanh công thương nghiệp tư nhân.",
            isCorrect: false,
            feedback: "Chưa chính xác! Một xã hội thuộc địa nửa phong kiến phải trải qua cuộc cách mạng dân tộc dân chủ trước khi tiến lên CNXH.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Ưu tiên tập trung đánh đổ giai cấp địa chủ phong kiến trước, sau đó mới tính đến việc đánh đuổi thực dân Pháp.",
            isCorrect: false,
            feedback: "Sai! Đây là nhận thức tả khuynh tách rời dân tộc với dân chủ; mâu thuẫn dân tộc với thực dân Pháp là mâu thuẫn chủ yếu nhất.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Làm tư sản dân quyền cách mạng và thổ địa cách mạng để đi tới xã hội cộng sản.",
            isCorrect: true,
            feedback: "Chính xác! Hai nhiệm vụ chống đế quốc và phong kiến gắn bó khăng khít, đặt độc lập dân tộc lên hàng đầu và mở đường tiến lên chủ nghĩa xã hội.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Sự kiện thành lập Đảng Cộng sản Việt Nam ngày 3/2/1930 có ý nghĩa lịch sử vĩ đại thế nào đối với vận mệnh dân tộc?",
        options: [
          {
            text: "A. Chấm dứt thời kỳ khủng hoảng sâu sắc về đường lối cứu nước và giai cấp lãnh đạo; cách mạng Việt Nam trở thành bộ phận khăng khít của cách mạng vô sản thế giới.",
            isCorrect: true,
            feedback: "Hoàn toàn chính xác! Bác Hồ từng viết: 'Nó chứng tỏ rằng giai cấp vô sản ta đã trưởng thành và đủ sức lãnh đạo cách mạng'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Buộc toàn quyền Pháp phải tuyên bố trao trả độc lập hoàn toàn cho Đông Dương ngay trong năm 1930.",
            isCorrect: false,
            feedback: "Sai! Thực dân Pháp đàn áp tàn bạo, Đảng ta phải kiên cường lãnh đạo nhân dân qua 15 năm gian khổ mới tới thắng lợi 1945.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Xác lập bang giao ngoại giao chính thức với các nước trong khối Đồng minh chống phát xít.",
            isCorrect: false,
            feedback: "Sai! Năm 1930 Đảng còn hoạt động bí mật bất hợp pháp, chưa có nhà nước để thiết lập ngoại giao.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Thống nhất toàn bộ các đơn vị du kích vũ trang thành một quân đội chính quy hiện đại ngay lập tức.",
            isCorrect: false,
            feedback: "Chưa đúng! Lực lượng vũ trang cách mạng tiền thân mãi đến năm 1944 mới chính thức ra đời tại Cao Bằng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_KIM_DONG: {
    id: 'NPC_KIM_DONG',
    name: "Kim Đồng",
    role: "Đội trưởng Đội Nhi đồng Cứu quốc (1941)",
    mapId: 'MAP_PACBO',
    x: 7,
    y: 17,
    spriteKey: 'npcKimDong',
    directiveKey: 'null',
    questions: [
      {
        question: "Ngày 15/5/1941, tại Nà Mạ (Hà Quảng, Cao Bằng), Đội Nhi đồng Cứu quốc (tiền thân Đội TNTP Hồ Chí Minh) thành lập gồm 5 đội viên, ai là đội trưởng đầu tiên?",
        options: [
          {
            text: "A. Nông Văn Thâu (bí danh Cao Sơn).",
            isCorrect: false,
            feedback: "Chưa đúng! Cao Sơn là một trong 5 đội viên đầu tiên nhưng không giữ chức vụ đội trưởng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Nông Văn Dền (bí danh Kim Đồng).",
            isCorrect: true,
            feedback: "Chính xác! Kim Đồng là người đội trưởng thiếu niên kiên cường, thông minh và mưu trí tuyệt vời của Đội Nhi đồng Cứu quốc.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Thiếu niên anh hùng Vừ A Dính.",
            isCorrect: false,
            feedback: "Sai! Anh hùng Vừ A Dính tham gia kháng chiến chống Pháp ở núi rừng Tây Bắc thời kỳ sau này.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Nông Văn Bế (bí danh Thanh Minh).",
            isCorrect: false,
            feedback: "Chưa đúng! Thanh Minh là một đội viên trong tổ chức 5 người đầu tiên.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Hành động anh hùng nào của Kim Đồng (tháng 2/1943) đã mãi mãi tạc vào lịch sử cách mạng tuổi trẻ Việt Nam?",
        options: [
          {
            text: "A. Trực tiếp tham gia cầm súng chỉ huy trận phục kích đồn Phai Khắt tiêu diệt quân Pháp.",
            isCorrect: false,
            feedback: "Sai! Trận Phai Khắt do Đội Việt Nam Tuyên truyền Giải phóng quân tổ chức vào tháng 12/1944.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Vận động toàn thể thiếu nhi bản Nà Mạ tổ chức bãi khóa biểu tình phản đối thu thuế.",
            isCorrect: false,
            feedback: "Sai! Nhiệm vụ chính của Đội là giao liên, bảo vệ cơ sở cách mạng bí mật.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Dũng cảm đánh lạc hướng quân địch để bảo vệ an toàn cho cán bộ Trung ương Đảng đang họp bí mật rồi anh dũng hy sinh.",
            isCorrect: true,
            feedback: "Chính xác! Tiếng súng nổ cảnh giới và sự hy sinh của Kim Đồng bên bờ suối Lê-nin đã cứu thoát toàn bộ cán bộ cách mạng an toàn.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Lợi dụng đêm tối đột nhập vào kho thuốc súng của đồn lính dõng huyện Hà Quảng phá hủy hỏa lực.",
            isCorrect: false,
            feedback: "Không chính xác! Tấm gương bất tử của Kim Đồng là nhiệm vụ trinh sát, cảnh giới bảo vệ lãnh đạo Đảng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_BAC_HO_PACBO: {
    id: 'NPC_BAC_HO_PACBO',
    name: "Bác Hồ (Pác Bó)",
    role: "Lãnh tụ Nguyễn Ái Quốc về nước (1941)",
    mapId: 'MAP_PACBO',
    x: 25,
    y: 7,
    spriteKey: 'npcBacHo',
    directiveKey: 'DIR_1941_TW8',
    directiveTitle: "Nghị quyết Hội nghị TW 8 Pác Bó (5/1941) — Mặt trận Việt Minh",
    directiveYear: 1941,
    questions: [
      {
        question: "Ngày 28/1/1941, sau 30 năm bôn ba tìm đường cứu nước, Bác Hồ trở về Tổ quốc qua cột mốc biên giới số mấy tại Cao Bằng?",
        options: [
          {
            text: "A. Cột mốc 92 (vùng biên giới ven biển Móng Cái, Quảng Ninh).",
            isCorrect: false,
            feedback: "Sai! Bác Hồ về nước qua đường mòn hiểm trở vùng biên giới Việt - Trung thuộc tỉnh Cao Bằng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Cột mốc 118 (vùng cao nguyên đá Đồng Văn, Hà Giang).",
            isCorrect: false,
            feedback: "Sai! Căn cứ địa lịch sử được Bác chọn là Pác Bó, tỉnh Cao Bằng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Cột mốc 79 (cửa khẩu biên giới Hữu Nghị, Lạng Sơn).",
            isCorrect: false,
            feedback: "Sai! Cột mốc lịch sử thuộc địa phận xã Trường Hà, huyện Hà Quảng, tỉnh Cao Bằng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Cột mốc 108 (nay là cột mốc 675 biên giới Việt - Trung thuộc xã Trường Hà, Hà Quảng, Cao Bằng).",
            isCorrect: true,
            feedback: "Chính xác! Nhà thơ Tố Hữu đã xúc động viết: 'Kìa bóng Bác đang hôn lên hòn đất / Lắng nghe trong màu hồng hình đất nước phôi thai'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Hội nghị Trung ương 8 (tháng 5/1941 tại Pác Bó) do Bác Hồ chủ trì đã hoàn chỉnh chủ trương chuyển hướng chỉ đạo chiến lược cách mạng như thế nào?",
        options: [
          {
            text: "A. Đặt nhiệm vụ giải phóng dân tộc lên hàng đầu; thành lập Mặt trận Việt Minh và chuẩn bị khởi nghĩa vũ trang là nhiệm vụ trung tâm.",
            isCorrect: true,
            feedback: "Rất chính xác! Hội nghị nhấn mạnh: 'Trong lúc này quyền lợi của bộ phận, của giai cấp phải đặt dưới quyền lợi giải phóng của toàn thể dân tộc'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Tập trung toàn diện vào cải cách ruộng đất, đấu tranh triệt để tịch thu ruộng đất của toàn bộ địa chủ chia cho nông dân.",
            isCorrect: false,
            feedback: "Sai lầm! Để đại đoàn kết toàn dân chống phát xít Nhật - Pháp, Đảng tạm gác khẩu hiệu tịch thu ruộng đất địa chủ phong kiến.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Chủ trương từ bỏ vũ trang tự vệ, chuyển sang tranh cử ghế đại biểu trong các viện dân biểu của Pháp.",
            isCorrect: false,
            feedback: "Sai! Thực dân phát xít cai trị bằng súng đạn khủng bố, Đảng kiên định con đường bạo lực cách mạng chuẩn bị khởi nghĩa.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Giải tán các chiến khu rừng núi hiểm trở để dồn toàn bộ cán bộ về chỉ đạo bãi công tại các đô thị lớn.",
            isCorrect: false,
            feedback: "Hoàn toàn sai! Hội nghị chỉ thị phải tích cực xây dựng căn cứ địa cách mạng Pác Bó và phát triển lực lượng vũ trang.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_TRAN_PHU: {
    id: 'NPC_TRAN_PHU',
    name: "Trần Phú",
    role: "Tổng Bí thư đầu tiên của Đảng (10/1930)",
    mapId: 'MAP_HANOI',
    x: 5,
    y: 6,
    spriteKey: 'npcTranPhu',
    directiveKey: 'DIR_1930_LUANCUONG',
    directiveTitle: "Luận cương chính trị tháng 10/1930",
    directiveYear: 1930,
    questions: [
      {
        question: "Tháng 10/1930, tại Hội nghị Ban Chấp hành Trung ương họp ở Hương Cảng, đồng chí Trần Phú đã soạn thảo văn kiện lịch sử quan trọng nào?",
        options: [
          {
            text: "A. Tác phẩm lý luận quân sự 'Kháng chiến nhất định thắng lợi'.",
            isCorrect: false,
            feedback: "Sai! Đây là tác phẩm lý luận kinh điển của đồng chí Trường Chinh xuất bản năm 1947 trong kháng chiến chống Pháp.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Bản Luận cương chính trị tháng 10/1930 của Đảng Cộng sản Đông Dương.",
            isCorrect: true,
            feedback: "Chính xác! Luận cương phân tích tính chất cách mạng Đông Dương, xác định sứ mệnh lịch sử của giai cấp công nhân và vai trò hạt nhân lãnh đạo của Đảng.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Bản Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa.",
            isCorrect: false,
            feedback: "Sai! Tuyên ngôn Độc lập do Chủ tịch Hồ Chí Minh soạn thảo và công bố ngày 2/9/1945 tại Ba Đình.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Bản Cương lĩnh chính trị đầu tiên của Đảng Cộng sản Việt Nam.",
            isCorrect: false,
            feedback: "Sai! Cương lĩnh chính trị đầu tiên do đồng chí Nguyễn Ái Quốc khởi thảo vào tháng 2/1930.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Trước khi hy sinh oanh liệt trong ngục tù thực dân Pháp tại Nhà thương Chợ Quán (9/1931), Tổng Bí thư Trần Phú đã nhắn nhủ đồng chí điều gì?",
        options: [
          {
            text: "A. 'Không có gì quý hơn độc lập, tự do!'.",
            isCorrect: false,
            feedback: "Sai! Đây là chân lý bất hủ được Chủ tịch Hồ Chí Minh khẳng định trong thời kỳ kháng chiến chống Mỹ cứu nước.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. 'Tổ quốc trên hết, độc lập trên hết!'.",
            isCorrect: false,
            feedback: "Sai! Đây là khẩu hiệu hành động cách mạng thời kỳ tiền khởi nghĩa năm 1945.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. 'Hãy giữ vững chí khí chiến đấu!'.",
            isCorrect: true,
            feedback: "Rất chính xác! Lời trăng trối thiêng liêng của Tổng Bí thư Trần Phú là ngọn đuốc rực lửa thôi thúc các thế hệ chiến sĩ cộng sản kiên trung bảo vệ Đảng.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. 'Quyết tử để Tổ quốc quyết sinh!'.",
            isCorrect: false,
            feedback: "Sai! Đây là lời biểu dương khen ngợi của Bác Hồ dành cho các chiến sĩ quyết tử quân Thủ đô mùa đông năm 1946.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_LE_HONG_PHONG: {
    id: 'NPC_LE_HONG_PHONG',
    name: "Lê Hồng Phong",
    role: "Tổng Bí thư - Khôi phục hệ thống tổ chức Đảng (1935)",
    mapId: 'MAP_HANOI',
    x: 26,
    y: 18,
    spriteKey: 'npcLeHongPhong',
    directiveKey: 'DIR_1935_DAIHOI1',
    directiveTitle: "Nghị quyết Đại hội Đảng lần thứ I (3/1935)",
    directiveYear: 1935,
    questions: [
      {
        question: "Sau đợt 'khủng bố trắng' tàn bạo của thực dân Pháp (1931-1933), Đại hội Đảng lần thứ nhất (3/1935) họp ở Ma Cao (Trung Quốc) do ai chủ trì đã đánh dấu sự phục hồi hệ thống tổ chức của Đảng?",
        options: [
          {
            text: "A. Đồng chí Nguyễn Ái Quốc.",
            isCorrect: false,
            feedback: "Sai! Lúc này Nguyễn Ái Quốc đang hoạt động và nghiên cứu học tập tại Viện Lênin ở Moscow (Liên Xô).",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Đồng chí Ngô Gia Tự.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Ngô Gia Tự đã bị giặc Pháp bắt giam đày ải tại Côn Đảo và hy sinh năm 1935.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Đồng chí Trường Chinh.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Trường Chinh đang bị giặc giam cầm tại ngục tù Sơn La, đến cuối năm 1936 mới được trả tự do.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Đồng chí Lê Hồng Phong và Ban Chỉ huy ở ngoài của Đảng.",
            isCorrect: true,
            feedback: "Chính xác! Đại hội lần thứ nhất đã củng cố đường lối, khôi phục phong trào và bầu đồng chí Lê Hồng Phong làm Tổng Bí thư của Đảng.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      }
    ]
  },
  NPC_HA_HUY_TAP: {
    id: 'NPC_HA_HUY_TAP',
    name: "Hà Huy Tập",
    role: "Tổng Bí thư - Phong trào Dân chủ (1936 — 1938)",
    mapId: 'MAP_HANOI',
    x: 26,
    y: 6,
    spriteKey: 'npcHaHuyTap',
    directiveKey: 'DIR_1936_DANCHU',
    directiveTitle: "Nghị quyết Hội nghị Ban Chấp hành TW (7/1936)",
    directiveYear: 1936,
    questions: [
      {
        question: "Trong phong trào Dân chủ (1936-1939), Đảng ta do đồng chí Hà Huy Tập làm Tổng Bí thư đã tận dụng điều kiện thuận lợi nào để mở rộng đấu tranh công khai, hợp pháp?",
        options: [
          {
            text: "A. Chính phủ Mặt trận Nhân dân Pháp lên nắm quyền thi hành chính sách tiến bộ nới lỏng tự do dân chủ ở thuộc địa.",
            isCorrect: true,
            feedback: "Rất chính xác! Đảng đã kịp thời chuyển hướng sách lược, triệt để tận dụng các hình thức công khai và nửa công khai để giác ngộ đông đảo quần chúng.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Toàn quyền thực dân Pháp tuyên bố từ bỏ chế độ bảo hộ và tự nguyện trao quyền tự trị cho người Việt.",
            isCorrect: false,
            feedback: "Sai lầm! Thực dân Pháp không bao giờ từ bỏ dã tâm bóc lột thống trị thuộc địa nếu không bị đấu tranh buộc phải nhượng bộ.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Phát xít Nhật đưa quân vào chiếm đóng ép toàn quyền Pháp phải thực hiện cải cách dân sinh.",
            isCorrect: false,
            feedback: "Sai! Tháng 9/1940 phát xít Nhật mới tràn vào Đông Dương và câu kết với Pháp tăng cường bóc lột nhân dân ta dã man hơn.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Hội Quốc Liên cử phái đoàn thanh tra quốc tế áp đặt tổng tuyển cử độc lập tại các xứ Đông Dương.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Hội Quốc Liên là tổ chức tư sản bất lực, không bảo vệ lợi ích của các dân tộc thuộc địa.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_PHAN_DANG_LUU: {
    id: 'NPC_PHAN_DANG_LUU',
    name: "Phan Đăng Lưu",
    role: "Ủy viên TW - Ngọn cờ Báo chí Dân chủ (1936 — 1940)",
    mapId: 'MAP_HANOI',
    x: 5,
    y: 18,
    spriteKey: 'npcNhaBao',
    directiveKey: 'null',
    questions: [
      {
        question: "Đồng chí Phan Đăng Lưu là linh hồn của phong trào báo chí công khai thời kỳ Dân chủ (1936-1939) tại Trung Kỳ. Mục tiêu chủ yếu của phong trào Đông Dương Đại hội là gì?",
        options: [
          {
            text: "A. Vận động nhân dân ghi tên đi lính sang châu Âu để bảo vệ nước Pháp trước hiểm họa chiến tranh thế giới.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Đảng ta kiên quyết vạch trần thủ đoạn bắt lính, bắt phu của chính quyền thực dân.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Thu thập 'dân nguyện', đòi quyền tự do dân chủ, cơm áo hòa bình và phản kháng sự áp bức bóc lột của thực dân phong kiến.",
            isCorrect: true,
            feedback: "Chính xác! Phong trào Đông Dương Đại hội đã lôi cuốn hàng triệu người dân khắp ba kỳ ký tên vào bản dân nguyện đấu tranh đòi quyền sống.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Kêu gọi các chủ xưởng trong nước hùn vốn mở công ty cổ phần thương mại cạnh tranh tư bản phương Tây.",
            isCorrect: false,
            feedback: "Sai! Đây không phải là nội dung hay mục tiêu của phong trào đấu tranh do Đảng lãnh đạo.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Thỉnh nguyện triều đình nhà Nguyễn ban hành bản Hiến pháp mới theo thể chế quân chủ đại nghị kiểu Anh.",
            isCorrect: false,
            feedback: "Sai! Phong trào nhắm thẳng vào các yêu sách thiết thực hàng ngày của quảng đại quần chúng lao động: tự do, cơm áo, hòa bình.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_NGUYEN_VAN_CU: {
    id: 'NPC_NGUYEN_VAN_CU',
    name: "Nguyễn Văn Cừ",
    role: "Tổng Bí thư tuổi 26 — Tác giả \"Tự chỉ trích\" & Chủ trì TW 6 (1939)",
    mapId: 'MAP_BADIEM',
    x: 8,
    y: 7,
    spriteKey: 'npcNguyenVanCu',
    directiveKey: 'DIR_1939_TUCHITRICH',
    directiveTitle: "Tác phẩm \"Tự chỉ trích\" (7/1939) & NQ TW 6 (11/1939)",
    directiveYear: 1939,
    questions: [
      {
        question: "Tháng 7/1939, Tổng Bí thư Nguyễn Văn Cừ xuất bản tác phẩm lý luận bất hủ 'Tự chỉ trích' nhằm giải quyết vấn đề cấp bách nào trong nội bộ Đảng?",
        options: [
          {
            text: "A. Công khai trục xuất và chia rẽ các đảng viên có quan điểm tranh luận trái chiều ra khỏi tổ chức.",
            isCorrect: false,
            feedback: "Sai lầm! Mục đích của tác phẩm là xây dựng sự đoàn kết thống nhất vững chắc trên nền tảng tư tưởng Mác - Lênin.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Xóa bỏ hoàn toàn nguyên tắc hoạt động bí mật của Đảng để chuyển sang công khai hợp pháp vĩnh viễn.",
            isCorrect: false,
            feedback: "Sai! Khi nguy cơ CTTG II cận kề, Đảng cần cảnh giác cao độ và rút vào hoạt động bí mật để bảo toàn thực lực.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Thống nhất nhận thức, dùng vũ khí tự phê bình và phê bình một cách trung thực, thẳng thắn để củng cố đoàn kết và nâng cao uy tín lãnh đạo của Đảng.",
            isCorrect: true,
            feedback: "Chính xác! Tác phẩm khẳng định: 'Đảng không sợ khuyết điểm, chỉ sợ không thật thà nhận khuyết điểm để tìm cách sửa chữa'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Đề nghị giải tán Ban Thường vụ Trung ương để nhường quyền quyết định cho các chi bộ địa phương tự quản.",
            isCorrect: false,
            feedback: "Sai! Tác phẩm nhấn mạnh tính tập trung dân chủ và kỷ luật thép của một chính đảng vô sản mác-xít.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Hội nghị Trung ương 6 (tháng 11/1939 tại Bà Điểm, Hóc Môn) do đồng chí Nguyễn Văn Cừ chủ trì có ý nghĩa chiến lược lịch sử nào?",
        options: [
          {
            text: "A. Quyết định thỏa hiệp ngoại giao lâu dài và hợp tác kinh tế toàn diện với đế quốc phát xít Nhật Bản.",
            isCorrect: false,
            feedback: "Sai! Đảng ta luôn kiên quyết vạch rõ bản chất xâm lược dã man của chủ nghĩa phát xít Nhật.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Tuyên bố tạm ngừng mọi hoạt động đấu tranh cách mạng của Xứ ủy Nam Kỳ vì sự đàn áp khốc liệt.",
            isCorrect: false,
            feedback: "Sai! Xứ ủy Nam Kỳ luôn là pháo đài cách mạng kiên cường của nhân dân miền Nam.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Chuyển toàn bộ cơ quan chỉ đạo đầu não cách mạng sang hải ngoại để đảm bảo an toàn tuyệt đối.",
            isCorrect: false,
            feedback: "Sai! Trung ương Đảng kiên quyết bám sát địa bàn trong nước, sống chết cùng phong trào của quần chúng nhân dân.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Mở đầu sự chuyển hướng chỉ đạo chiến lược: Đặt nhiệm vụ giải phóng dân tộc lên hàng đầu, thành lập Mặt trận Thống nhất Dân tộc Phản đế Đông Dương.",
            isCorrect: true,
            feedback: "Rất chính xác! Hội nghị nhấn mạnh: Bước đường sinh tồn của các dân tộc Đông Dương không có con đường nào khác hơn là đánh đổ đế quốc Pháp xâm lược.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      }
    ]
  },
  NPC_MA_BAY: {
    id: 'NPC_MA_BAY',
    name: "Má Bảy",
    role: "Cơ sở Nuôi giấu Cán bộ Bà Điểm (1940)",
    mapId: 'MAP_BADIEM',
    x: 23,
    y: 16,
    spriteKey: 'npcMaBay',
    directiveKey: 'null',
    questions: [
      {
        question: "Trong cuộc Khởi nghĩa Nam Kỳ đêm 22 rạng ngày 23/11/1940, biểu tượng thiêng liêng nào của cách mạng Việt Nam đã lần đầu tiên xuất hiện tung bay?",
        options: [
          {
            text: "A. Lá cờ đỏ sao vàng năm cánh (tung bay tại đình Long Hưng, Mỹ Tho và khắp các tỉnh Nam Kỳ).",
            isCorrect: true,
            feedback: "Chính xác! Lá cờ đỏ sao vàng nhuộm thắm máu đào của các chiến sĩ kiên trung Nam Kỳ đã trở thành Quốc kỳ thiêng liêng của nước Việt Nam.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Lá cờ búa liềm của Quốc tế Cộng sản.",
            isCorrect: false,
            feedback: "Chưa đúng! Cờ búa liềm là cờ Đảng, còn lá cờ cách mạng đại diện cho độc lập của Tổ quốc xuất hiện ở Nam Kỳ là Cờ đỏ sao vàng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Lá cờ Long tinh bát quái của phong trào Cần Vương tôn phò vua Hàm Nghi.",
            isCorrect: false,
            feedback: "Sai! Cờ Long tinh thuộc biểu trưng hoàng gia phong kiến cuối thế kỷ XIX.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Lá cờ hòa bình xanh lam của tổ chức Liên Hợp Quốc.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Năm 1940 Liên Hợp Quốc còn chưa ra đời.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Bài học lịch sử lớn nhất mà nhân dân 18 thôn vườn trầu Bà Điểm để lại cho Đảng ta là gì?",
        options: [
          {
            text: "A. Trông cậy sự viện trợ tài chính và khí tài quân sự từ các nước đế quốc phương Tây.",
            isCorrect: false,
            feedback: "Sai hoàn toàn! Cách mạng giải phóng dân tộc chỉ có thể thành công khi dựa chắc vào sức mạnh đại đoàn kết toàn dân tộc.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Bài học 'Lấy dân làm gốc': Nhân dân chính là căn cứ địa an toàn nhất, che chở, bảo bọc Trung ương Đảng vượt qua mọi đợt khủng bố khốc liệt.",
            isCorrect: true,
            feedback: "Rất chính xác! Vườn trầu Bà Điểm mộc mạc đã che giấu các lãnh tụ Trung ương ngay sát sào huyệt quân thù tại Sài Gòn, chứng minh chân lý 'Lòng dân là thành lũy kiên cố nhất'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Chỉ tổ chức cách mạng ở các đô thị lớn nơi tập trung nhiều tầng lớp tư sản và trí thức.",
            isCorrect: false,
            feedback: "Sai! Nông thôn và vùng phụ cận chính là hậu cứ cách mạng chiến lược sống còn cho cuộc đấu tranh.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Chờ đợi đối phương tự suy yếu về kinh tế rồi mới cử đại diện đàm phán chuyển giao chính quyền.",
            isCorrect: false,
            feedback: "Sai! Tinh thần cách mạng là chủ động rèn cán chỉnh quân, phát động quần chúng đấu tranh kiên quyết tự cứu lấy mình.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_HOANG_VAN_THU: {
    id: 'NPC_HOANG_VAN_THU',
    name: "Hoàng Văn Thụ",
    role: "Lãnh tụ Khởi nghĩa Bắc Sơn (1940)",
    mapId: 'MAP_TANTRAO',
    x: 6,
    y: 6,
    spriteKey: 'npcHoangVanThu',
    directiveKey: 'null',
    questions: [
      {
        question: "Ngày 27/9/1940, cuộc Khởi nghĩa Bắc Sơn (Lạng Sơn) bùng nổ. Ý nghĩa lịch sử mở đầu của sự kiện này là gì?",
        options: [
          {
            text: "A. Đánh tan tành toàn bộ quân viễn chinh phát xít Nhật trên toàn cõi Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Đây là cuộc khởi nghĩa bùng nổ tại địa phương mở đầu thời kỳ đấu tranh vũ trang mới.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Đưa phong trào quay lại hình thức đấu tranh kinh tế và vận động hợp pháp nghị trường.",
            isCorrect: false,
            feedback: "Sai! Khởi nghĩa Bắc Sơn là phát súng mở màn cho thời kỳ đấu tranh vũ trang giải phóng dân tộc.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Khởi nghĩa Bắc Sơn khai sinh Đội du kích Bắc Sơn - một trong những mầm mống lực lượng vũ trang đầu tiên của Đảng.",
            isCorrect: true,
            feedback: "Chính xác! Từ Đội du kích Bắc Sơn sau này đã phát triển thành các Trung đội Cứu quốc quân anh dũng kiên cường trên chiến khu.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Giải tán các căn cứ địa rừng núi hiểm trở để chuyển sang hoạt động đô thị hóa ngầm.",
            isCorrect: false,
            feedback: "Sai! Cuộc khởi nghĩa khẳng định tầm quan trọng đặc biệt của căn cứ địa rừng núi làm chỗ đứng chân cho cách mạng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_VO_NGUYEN_GIAP: {
    id: 'NPC_VO_NGUYEN_GIAP',
    name: "Võ Nguyên Giáp",
    role: "Chỉ huy Đội VNTTGPQ (1944) — Căn cứ Tân Trào",
    mapId: 'MAP_TANTRAO',
    x: 8,
    y: 17,
    spriteKey: 'npcVoNguyenGiap',
    directiveKey: 'DIR_1944_VNTTGPQ',
    directiveTitle: "Chỉ thị thành lập Đội VNTTGPQ (22/12/1944)",
    directiveYear: 1944,
    questions: [
      {
        question: "Ngày 22/12/1944, Đội Việt Nam Tuyên truyền Giải phóng quân thành lập tại khu rừng Trần Hưng Đạo (Cao Bằng) gồm bao nhiêu chiến sĩ và do ai trực tiếp chỉ huy?",
        options: [
          {
            text: "A. 12 chiến sĩ dũng cảm, do đồng chí Phùng Chí Kiên chỉ huy.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Phùng Chí Kiên đã anh dũng hy sinh năm 1941 tại Na Rì, Bắc Kạn.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. 50 chiến sĩ vũ trang, do đồng chí Chu Văn Tấn chỉ huy.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Chu Văn Tấn là chỉ huy của Đội Cứu quốc quân Bắc Sơn.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. 100 chiến sĩ cảm tử, do đồng chí Hoàng Văn Thái làm đội trưởng.",
            isCorrect: false,
            feedback: "Sai! Đồng chí Hoàng Văn Thái sau này là Tổng Tham mưu trưởng đầu tiên của Quân đội nhân dân Việt Nam.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. 34 chiến sĩ (với 34 khẩu súng), do đồng chí Võ Nguyên Giáp chỉ huy theo chỉ thị của Bác Hồ.",
            isCorrect: true,
            feedback: "Rất chính xác! Đội đã lập chiến công vang dội ngay trận đầu tại Phai Khắt và Nà Ngần, mở đầu truyền thống bách chiến bách thắng của QĐND Việt Nam quang vinh.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      },
      {
        question: "Tháng 5/1945, Hội nghị Quân sự cách mạng Bắc Kỳ quyết định thống nhất các lực lượng vũ trang cách mạng trong cả nước thành tổ chức nào?",
        options: [
          {
            text: "A. Việt Nam Giải phóng quân.",
            isCorrect: true,
            feedback: "Chính xác! Thống nhất Đội Việt Nam Tuyên truyền Giải phóng quân và các đội Cứu quốc quân thành Việt Nam Giải phóng quân, làm quả đấm quân sự nòng cốt cho Tổng khởi nghĩa.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "B. Quân đội Quốc gia Việt Nam.",
            isCorrect: false,
            feedback: "Sai! Tên gọi Quân đội Quốc gia Việt Nam được dùng từ tháng 5/1946 đến năm 1950.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Vệ quốc đoàn liên khu.",
            isCorrect: false,
            feedback: "Sai! Tên gọi Vệ quốc đoàn xuất hiện sau khi Cách mạng Tháng Tám đã giành được chính quyền trong cả nước.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Hồng quân Vô sản Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Lực lượng vũ trang cách mạng Việt Nam không sử dụng danh xưng này.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_TRUONG_CHINH: {
    id: 'NPC_TRUONG_CHINH',
    name: "Trường Chinh",
    role: "Tổng Bí thư - Ban Khởi nghĩa Tân Trào (1943 — 1945)",
    mapId: 'MAP_TANTRAO',
    x: 26,
    y: 6,
    spriteKey: 'npcTruongChinh',
    directiveKey: 'DIR_1945_QUANLENH1',
    directiveTitle: "Chỉ thị \"Nhật - Pháp bắn nhau\" & Quân lệnh số 1 (8/1945)",
    directiveYear: 1945,
    questions: [
      {
        question: "Khi Nhật đảo chính Pháp đêm 9/3/1945, Ban Thường vụ Trung ương Đảng do đồng chí Trường Chinh chủ trì đã ra bản Chỉ thị lịch sử mang tên gì vào ngày 12/3/1945?",
        options: [
          {
            text: "A. Bản Tuyên ngôn hành động của Mặt trận Việt Minh.",
            isCorrect: false,
            feedback: "Sai! Tuyên ngôn Việt Minh được ban bố từ tháng 5/1941 khi thành lập Mặt trận tại Pác Bó.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. 'Nhật - Pháp bắn nhau và hành động của chúng ta'.",
            isCorrect: true,
            feedback: "Rất chính xác! Bản chỉ thị có tầm nhìn chiến lược dự báo thiên tài thời cơ khởi nghĩa, xác định kẻ thù cụ thể trước mắt là phát xít Nhật và phát động cao trào kháng Nhật cứu nước làm tiền đề cho Tổng khởi nghĩa.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "C. Lời kêu gọi Toàn dân kháng chiến kiến quốc.",
            isCorrect: false,
            feedback: "Sai! Chỉ thị Kháng chiến kiến quốc được Trung ương ban hành vào tháng 11/1945 sau khi nước nhà đã độc lập.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. Lời hiệu triệu Tổng tuyển cử lập hiến toàn quốc.",
            isCorrect: false,
            feedback: "Sai! Cuộc Tổng tuyển cử đầu tiên bầu Quốc hội khóa I diễn ra ngày 6/1/1946.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      },
      {
        question: "Đêm 13/8/1945, tại Tân Trào, Ủy ban Khởi nghĩa toàn quốc đã ban bố văn kiện lịch sử nào lệnh cho toàn thể quân dân đồng loạt đứng lên giành chính quyền?",
        options: [
          {
            text: "A. Quân lệnh số 5 về việc động viên thanh niên nhập ngũ khẩn cấp.",
            isCorrect: false,
            feedback: "Sai! Không có văn kiện tên Quân lệnh số 5 trong sự kiện Tân Trào đêm 13/8/1945.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Hịch xuất quân thần tốc tiêu diệt quân Nhật đầu hàng.",
            isCorrect: false,
            feedback: "Sai! Văn kiện lịch sử chính thức được Ủy ban Khởi nghĩa toàn quốc ban bố mang tên Quân lệnh số 1.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Quân lệnh số 1 phát động Tổng khởi nghĩa giành chính quyền trong toàn quốc.",
            isCorrect: true,
            feedback: "Chính xác! 'Giờ tổng khởi nghĩa đã đánh! Cơ hội có một không hai cho quân dân Việt Nam vùng dậy giành lấy quyền độc lập của nước nhà!...'.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          },
          {
            text: "D. Bản tuyên bố tiếp nhận chiếu thoái vị của triều đình vua Bảo Đại.",
            isCorrect: false,
            feedback: "Sai! Chiếu thoái vị của Bảo Đại diễn ra ngày 30/8/1945 tại Ngọ Môn (Huế).",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          }
        ]
      }
    ]
  },
  NPC_BAC_HO_BADINH: {
    id: 'NPC_BAC_HO_BADINH',
    name: "Chủ tịch Hồ Chí Minh (2/9/1945)",
    role: "Tuyên ngôn Độc lập — Khai sinh nước Việt Nam Dân chủ Cộng hòa",
    mapId: 'MAP_BADINH',
    x: 8,
    y: 15,
    spriteKey: 'npcBacHo',
    directiveKey: 'DIR_1945_TUYENNGON',
    directiveTitle: "Bản Tuyên ngôn Độc lập (2/9/1945)",
    directiveYear: 1945,
    questions: [
      {
        question: "Ngày 2/9/1945, tại Quảng trường Ba Đình lịch sử, Chủ tịch Hồ Chí Minh thay mặt Chính phủ Lâm thời đọc bản 'Tuyên ngôn Độc lập'. Câu kết bản Tuyên ngôn khẳng định ý chí đanh thép nào của dân tộc ta?",
        options: [
          {
            text: "A. Toàn thể dân tộc Việt Nam sẵn sàng nhượng bộ một phần lãnh thổ để đổi lấy hiệp định hòa hoãn với quân Đồng minh.",
            isCorrect: false,
            feedback: "Sai lầm hoàn toàn! Lập trường của Bác và dân tộc ta là kiên quyết bảo vệ toàn vẹn độc lập chủ quyền thiêng liêng.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "B. Kêu gọi quân đội viễn chinh Anh và Pháp tiếp tục giám sát an ninh trật tự tại Đông Dương.",
            isCorrect: false,
            feedback: "Sai! Bản Tuyên ngôn tuyên bố thoát ly hẳn mọi quan hệ thực dân với Pháp và xóa bỏ mọi hiệp ước bất bình đẳng đã ký.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "C. Đề nghị Hội Quốc Liên công nhận chính quyền bảo hộ phong kiến lập hiến mới của vua Bảo Đại.",
            isCorrect: false,
            feedback: "Sai! Chế độ quân chủ phong kiến bù nhìn đã hoàn toàn sụp đổ và vĩnh viễn chấm dứt.",
            massGain: 0,
            armedGain: 0,
            threatChange: 10
          },
          {
            text: "D. 'Toàn thể dân tộc Việt Nam quyết đem tất cả tinh thần và lực lượng, tính mạng và của cải để giữ vững quyền tự do, độc lập ấy!'.",
            isCorrect: true,
            feedback: "Chính xác tuyệt đối! Bản Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa, mở ra kỷ nguyên mới: kỷ nguyên độc lập, tự do và chủ nghĩa xã hội.",
            massGain: 15,
            armedGain: 5,
            threatChange: -5
          }
        ]
      }
    ]
  }
};;

// =========================================================================
// 4. ĐỊNH NGHĨA 6 BẢN ĐỒ CHI TIẾT (MAP DEFINITIONS)
// =========================================================================
const MAP_DEFINITIONS = {
  // MAP 0: QUẢNG TRƯỜNG ÁNH SÁNG (REPLICA CHUẨN 100% TRUYTIMDANCHU.SITE)
  MAP_QUANGTRUONG: {
    id: 'MAP_QUANGTRUONG',
    chapterNum: 0,
    title: 'KHỞI NGUỒN: QUẢNG TRƯỜNG ÁNH SÁNG',
    subtitle: 'Khảo cứu cùng: Anh, Bình, Linh, Ngọc, Dũng, Khánh, Đức, Hùng',
    groundLabel1: 'QUẢNG TRƯỜNG ÁNH SÁNG',
    groundLabel2: 'CON ĐƯỜNG ĐỘC LẬP',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
            row.push(TILES.FOREST);
          } else if (x >= 4 && x <= 15 && y >= 5 && y <= 19) {
            // Sân cỏ quảng trường trung tâm
            row.push(TILES.GRASS_PLAZA);
          } else if (x >= 15 && x <= 29 && y >= 10 && y <= 14) {
            // Lối đi cát sang cánh phải
            row.push(TILES.PATH);
          } else {
            row.push(TILES.GRASS);
          }
        }
        map.push(row);
      }
      return map;
    },
    // Khung viền đá sandstone quanh sân cỏ quảng trường (x: 4 to 15, y: 5 to 19)
    courtyardBorder: { x: 4, y: 5, w: 12, h: 15 },
    spawn: { x: 16, y: 12 },
    portals: [
      { x: 30, y: 12, targetMapId: 'MAP_PACBO', targetSpawn: { x: 3, y: 11 }, label: '✦ Cổng Thời Gian: Đến Pác Bó 1941 →' }
    ],
    props: [
      // 4 bục đá cẩm thạch ở 4 góc quảng trường như ảnh mẫu
      { key: 'pedestalStone', x: 5, y: 6, w: 48, h: 48 },
      { key: 'pedestalStone', x: 14, y: 6, w: 48, h: 48 },
      { key: 'pedestalStone', x: 5, y: 18, w: 48, h: 48 },
      { key: 'pedestalStone', x: 14, y: 18, w: 48, h: 48 },

      // Bảng tin gỗ bên cạnh Dũng
      { key: 'exhibitKiosk', x: 9, y: 13, w: 48, h: 56 },

      // Bục trưng bày hiện vật cạnh Trọng
      { key: 'propPodiumMuseum', x: 26, y: 9, w: 48, h: 64 },

      // Hàng cây Chibi bo tròn quanh viền cỏ như ảnh mẫu
      { key: 'propTreeChibi', x: 2, y: 2, w: 48, h: 64 },
      { key: 'propTreeChibi', x: 15, y: 2, w: 48, h: 64 },
      { key: 'propTreeChibi', x: 2, y: 20, w: 48, h: 64 },
      { key: 'propTreeChibi', x: 16, y: 21, w: 48, h: 64 },
      { key: 'propTreeChibi', x: 28, y: 20, w: 48, h: 64 }
    ],
    patrols: [
      { id: 'PATROL_QT_1', minX: 17, maxX: 27, y: 14, speed: 1.3, dir: 1, x: 20 },
      { id: 'PATROL_QT_2', minX: 18, maxX: 28, y: 7, speed: 1.2, dir: -1, x: 25 }
    ]
  },

  // MAP 1: PÁC BÓ (CAO BẰNG)
  MAP_PACBO: {
    id: 'MAP_PACBO',
    chapterNum: 1,
    title: 'CHƯƠNG 1: CĂN CỨ PÁC BÓ & SUỐI LÊ-NIN (1941)',
    subtitle: 'Nơi Bác Hồ về nước, dựng lán Khuổi Nặm, khai sinh Mặt trận Việt Minh',
    groundLabel1: 'SUỐI LÊ-NIN & NÚI CÁC MÁC',
    groundLabel2: 'CỘT MỐC 108',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) row.push(TILES.FOREST);
          else if (x >= 15 && x <= 17 && y >= 3 && y <= 20) row.push(TILES.WATER); // Suối Lê-nin
          else if (x <= 10 && y <= 6) row.push(TILES.ROCKY); // Vách đá Pác Bó
          else if (y >= 10 && y <= 12) row.push(TILES.PATH); // Lối đi cát
          else row.push(TILES.GRASS);
        }
        map.push(row);
      }
      return map;
    },
    spawn: { x: 5, y: 11 },
    portals: [
      { x: 1, y: 11, targetMapId: 'MAP_QUANGTRUONG', targetSpawn: { x: 28, y: 12 }, label: '← Về Quảng Trường Ánh Sáng' },
      { x: 30, y: 11, targetMapId: 'MAP_HANOI', targetSpawn: { x: 3, y: 11 }, label: 'Đến Hà Nội Phố Cổ →' }
    ],
    props: [
      { key: 'propCliffRock', x: 4, y: 2, w: 64, h: 64 },
      { key: 'propCliffRock', x: 8, y: 2, w: 64, h: 64 },
      { key: 'propTreePine', x: 5, y: 5, w: 48, h: 72 },
      { key: 'propTreePine', x: 9, y: 8, w: 48, h: 72 },
      { key: 'propTreePine', x: 25, y: 5, w: 48, h: 72 },
      { key: 'propBridgeWood', x: 15, y: 10, w: 64, h: 48 },
      { key: 'stoneTable', x: 22, y: 6, w: 64, h: 48 },
      { key: 'propHouseThatch', x: 4, y: 14, w: 80, h: 72 }
    ],
    patrols: [
      { id: 'PATROL_PACBO_1', minX: 18, maxX: 28, y: 14, speed: 1.25, dir: 1, x: 20 },
      { id: 'PATROL_PACBO_2', minX: 18, maxX: 27, y: 7, speed: 1.2, dir: -1, x: 24 },
      { id: 'PATROL_PACBO_3', axis: 'y', minY: 10, maxY: 19, x: 13, speed: 1.15, dir: 1, y: 14 }
    ]
  },

  // MAP 2: HÀ NỘI PHỐ CỔ (1930 — 1939)
  MAP_HANOI: {
    id: 'MAP_HANOI',
    chapterNum: 2,
    title: 'CHƯƠNG 2: ĐÔ THỊ HÀ NỘI PHỐ CỔ (1930 — 1939)',
    subtitle: 'Trung tâm đấu tranh chính trị, toà soạn Báo Dân Chúng và kiệt tác "Tự chỉ trích"',
    groundLabel1: 'PHỐ CỔ HÀ NỘI (1930 - 1939)',
    groundLabel2: 'TÒA SOẠN BÁO DÂN CHÚNG',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) row.push(TILES.FOREST);
          else if (x >= 4 && x <= 27 && y >= 5 && y <= 20) row.push(TILES.MUSEUM_FLOOR);
          else if (y >= 10 && y <= 12) row.push(TILES.PATH);
          else row.push(TILES.GRASS);
        }
        map.push(row);
      }
      return map;
    },
    spawn: { x: 3, y: 11 },
    portals: [
      { x: 1, y: 11, targetMapId: 'MAP_PACBO', targetSpawn: { x: 29, y: 11 }, label: '← Về Pác Bó' },
      { x: 16, y: 22, targetMapId: 'MAP_BADIEM', targetSpawn: { x: 16, y: 3 }, label: '↓ Vào Nam Kỳ Bà Điểm' },
      { x: 30, y: 11, targetMapId: 'MAP_TANTRAO', targetSpawn: { x: 3, y: 11 }, label: 'Lên Tân Trào →' }
    ],
    props: [
      { key: 'propBuildingHanoi', x: 7, y: 4, w: 96, h: 112 },
      { key: 'propBuildingHanoi', x: 15, y: 4, w: 96, h: 112 },
      { key: 'propBuildingHanoi', x: 23, y: 4, w: 96, h: 112 },
      { key: 'propStreetLamp', x: 6, y: 11, w: 32, h: 64 },
      { key: 'propStreetLamp', x: 14, y: 11, w: 32, h: 64 },
      { key: 'propStreetLamp', x: 22, y: 11, w: 32, h: 64 },
      { key: 'pedestalStone', x: 5, y: 19, w: 48, h: 48 },
      { key: 'pedestalStone', x: 26, y: 19, w: 48, h: 48 }
    ],
    patrols: [
      { id: 'PATROL_HANOI_1', minX: 6, maxX: 21, y: 11, speed: 1.35, dir: 1, x: 10 },
      { id: 'PATROL_HANOI_2', minX: 14, maxX: 27, y: 6, speed: 1.25, dir: -1, x: 22 },
      { id: 'PATROL_HANOI_3', minX: 7, maxX: 24, y: 19, speed: 1.3, dir: 1, x: 16 }
    ]
  },

  // MAP 3: BÀ ĐIỂM NAM KỲ (1939 — 1940)
  MAP_BADIEM: {
    id: 'MAP_BADIEM',
    chapterNum: 3,
    title: 'CHƯƠNG 3: VƯỜN TRẦU BÀ ĐIỂM — HÓC MÔN (1939 — 1940)',
    subtitle: 'Căn cứ Xứ ủy Nam Kỳ, 18 thôn vườn trầu và sự xuất hiện của Cờ đỏ sao vàng',
    groundLabel1: '18 THÔN VƯỜN TRẦU BÀ ĐIỂM',
    groundLabel2: 'CĂN CỨ XỨ ỦY NAM KỲ',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) row.push(TILES.FOREST);
          else if (x === 16 || y === 12) row.push(TILES.PATH);
          else row.push(TILES.GRASS);
        }
        map.push(row);
      }
      return map;
    },
    spawn: { x: 16, y: 3 },
    portals: [
      { x: 16, y: 1, targetMapId: 'MAP_HANOI', targetSpawn: { x: 16, y: 20 }, label: '↑ Trở về Hà Nội' },
      { x: 30, y: 12, targetMapId: 'MAP_TANTRAO', targetSpawn: { x: 3, y: 11 }, label: 'Đến Tân Trào →' }
    ],
    props: [
      { key: 'propTreePalm', x: 6, y: 6, w: 48, h: 80 },
      { key: 'propTreePalm', x: 11, y: 6, w: 48, h: 80 },
      { key: 'propTreePalm', x: 20, y: 6, w: 48, h: 80 },
      { key: 'propTreePalm', x: 25, y: 6, w: 48, h: 80 },
      { key: 'propHouseThatch', x: 7, y: 14, w: 80, h: 72 },
      { key: 'propHouseThatch', x: 21, y: 14, w: 80, h: 72 }
    ],
    patrols: [
      { id: 'PATROL_BADIEM_1', minX: 18, maxX: 28, y: 10, speed: 1.25, dir: 1, x: 20 },
      { id: 'PATROL_BADIEM_2', minX: 6, maxX: 15, y: 12, speed: 1.2, dir: -1, x: 8 },
      { id: 'PATROL_BADIEM_3', minX: 11, maxX: 25, y: 19, speed: 1.25, dir: 1, x: 18 }
    ]
  },

  // MAP 4: CHIẾN KHU TÂN TRÀO (1944 — 1945)
  MAP_TANTRAO: {
    id: 'MAP_TANTRAO',
    chapterNum: 4,
    title: 'CHƯƠNG 4: CHIẾN KHU TÂN TRÀO & RỪNG TRẦN HƯNG ĐẠO (1944 — 1945)',
    subtitle: 'Đội VNTTGPQ ra đời, Quốc dân Đại hội và Quân lệnh số 1 Toàn quốc Khởi nghĩa',
    groundLabel1: 'THỦ ĐÔ KHÁNG CHIẾN TÂN TRÀO',
    groundLabel2: 'CÂY ĐA TÂN TRÀO LỊCH SỬ',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) row.push(TILES.FOREST);
          else if ((x + y) % 7 === 0 && x > 20) row.push(TILES.FOREST);
          else if (y >= 10 && y <= 12) row.push(TILES.PATH);
          else row.push(TILES.GRASS);
        }
        map.push(row);
      }
      return map;
    },
    spawn: { x: 3, y: 11 },
    portals: [
      { x: 1, y: 11, targetMapId: 'MAP_HANOI', targetSpawn: { x: 28, y: 11 }, label: '← Về Hà Nội' },
      { x: 16, y: 22, targetMapId: 'MAP_BADINH', targetSpawn: { x: 16, y: 3 }, label: '↓ TIẾN VỀ BA ĐÌNH (2/9/1945)' }
    ],
    props: [
      { key: 'banyanTree', x: 15, y: 3, w: 96, h: 96 },
      { key: 'flagpoleRedStar', x: 22, y: 4, w: 64, h: 112 },
      { key: 'propTempleDinh', x: 23, y: 9, w: 112, h: 88 }
    ],
    patrols: [
      { id: 'PATROL_TANTRAO_1', minX: 10, maxX: 22, y: 14, speed: 1.25, dir: 1, x: 15 },
      { id: 'PATROL_TANTRAO_2', minX: 6, maxX: 17, y: 6, speed: 1.15, dir: 1, x: 8 },
      { id: 'PATROL_TANTRAO_3', minX: 16, maxX: 27, y: 11, speed: 1.25, dir: -1, x: 23 }
    ]
  },

  // MAP 5: ĐẠI LỄ ĐÀI BA ĐÌNH (2/9/1945)
  MAP_BADINH: {
    id: 'MAP_BADINH',
    chapterNum: 5,
    title: 'CHƯƠNG 5: ĐẠI LỄ ĐÀI BA ĐÌNH — TUYÊN NGÔN ĐỘC LẬP (2/9/1945)',
    subtitle: 'Nước Việt Nam Dân chủ Cộng hòa ra đời — Hoàn thành thắng lợi vẻ vang',
    groundLabel1: 'QUẢNG TRƯỜNG BA ĐÌNH (2/9/1945)',
    groundLabel2: 'NƯỚC VIỆT NAM DÂN CHỦ CỘNG HÒA',
    generator: () => {
      const map = [];
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) row.push(TILES.FOREST);
          else if (x >= 4 && x <= 27 && y >= 4 && y <= 20) row.push(TILES.MUSEUM_FLOOR);
          else if (x === 16 || y === 12) row.push(TILES.PATH);
          else row.push(TILES.GRASS);
        }
        map.push(row);
      }
      return map;
    },
    spawn: { x: 16, y: 3 },
    portals: [
      { x: 16, y: 1, targetMapId: 'MAP_TANTRAO', targetSpawn: { x: 16, y: 20 }, label: '↑ Về Chiến khu Tân Trào' }
    ],
    props: [
      { key: 'propPodiumBaDinh', x: 14, y: 5, w: 96, h: 80 },
      { key: 'flagpoleRedStar', x: 20, y: 4, w: 64, h: 112 },
      { key: 'exhibitKiosk', x: 23, y: 12, w: 96, h: 112 },
      { key: 'pedestalStone', x: 6, y: 16, w: 48, h: 48 },
      { key: 'pedestalStone', x: 25, y: 16, w: 48, h: 48 }
    ],
    patrols: [
      { id: 'PATROL_BADINH_1', minX: 6, maxX: 24, y: 12, speed: 1.2, dir: 1, x: 10 },
      { id: 'PATROL_BADINH_2', minX: 7, maxX: 25, y: 17, speed: 1.25, dir: -1, x: 20 }
    ]
  }
};

// =========================================================================
// 1. DANH MỤC VẬT PHẨM LỊCH SỬ RƠI THEO MỐC (SAU 2 - 3 NPC HOẶC HOÀN THÀNH PHẦN MAP)
// =========================================================================
const MILESTONE_DROPS = {
  // Map 0: Quảng Trường Ánh Sáng
  // Mốc 1: Hoàn thành 4 bạn đầu (Anh, Bình, Linh, Ngọc)
  NPC_NGOC: {
    id: 'ITEM_MANH_CUONG_LINH_1',
    name: 'Mảnh Cương Lĩnh Số 1 (Mục Tiêu Chính Trị)',
    desc: 'Bản thảo khẳng định đường lối: làm tư sản dân quyền cách mạng và thổ địa cách mạng để tiến tới xã hội cộng sản.',
    mapId: 'MAP_QUANGTRUONG'
  },
  // Mốc 2: Hoàn thành trọn vẹn 8 bạn (Dũng, Khánh, Đức, Hùng)
  NPC_HUNG: {
    id: 'ITEM_MANH_CUONG_LINH_2',
    name: 'Mảnh Cương Lĩnh Số 2 (Sách Lược & Tổ Chức)',
    desc: 'Bản thảo khẳng định Đảng là đội tiên phong của giai cấp vô sản, thu phục đại bộ phận giai cấp mình và củng cố khối liên minh công nông.',
    mapId: 'MAP_QUANGTRUONG'
  },
  // Map 1: Pác Bó (Kim Đồng & Bác Hồ)
  NPC_BAC_HO_PACBO: {
    id: 'ITEM_NGOI_SAO_PACBO',
    name: 'Ngôi Sao Vàng Pác Bó (1941)',
    desc: 'Huy hiệu ngôi sao vàng 5 cánh rực rỡ được Bác Hồ phác thảo tại lán Khuổi Nặm làm ngọn cờ tập hợp Mặt trận Việt Minh.',
    mapId: 'MAP_PACBO'
  },
  // Map 2: Phố Cổ Hà Nội (Trần Phú, Lê Hồng Phong, Hà Huy Tập)
  NPC_HA_HUY_TAP: {
    id: 'ITEM_BUT_TICH_CHI_DAO',
    name: 'Bút Tích Chỉ Đạo Phong Trào Hà Nội',
    desc: 'Tài liệu hướng dẫn tổ chức đấu tranh bí mật và bán công khai của Ban Thường vụ Trung ương tại Hà Nội.',
    mapId: 'MAP_HANOI'
  },
  // Map 3: Bà Điểm Hóc Môn (Phan Đăng Lưu, Nguyễn Văn Cừ, Má Bảy)
  NPC_MA_BAY: {
    id: 'ITEM_MANH_CO_DO_NAM_KY',
    name: 'Mảnh Cờ Đỏ Nam Kỳ Khởi Nghĩa (1940)',
    desc: 'Mảnh cờ vải đỏ thắm nhuốm máu đào anh dũng của nhân dân 18 thôn vườn trầu trong cuộc Khởi nghĩa Nam Kỳ.',
    mapId: 'MAP_BADIEM'
  },
  // Map 4: Chiến khu Tân Trào (Hoàng Văn Thụ, Võ Nguyên Giáp, Trường Chinh)
  NPC_TRUONG_CHINH: {
    id: 'ITEM_BAN_THAO_TUYEN_NGON',
    name: 'Bản Thảo Sơ Khởi Tuyên Ngôn Tân Trào',
    desc: 'Bản thảo đúc kết từ Quốc dân Đại hội Tân Trào và Quân lệnh số 1 Toàn quốc Khởi nghĩa.',
    mapId: 'MAP_TANTRAO'
  }
};

// =========================================================================
// 2. HỆ THỐNG GHÉP VẬT PHẨM LỊCH SỬ (QUAY VỀ MAP TRƯỚC ĐỂ GHÉP BẢO VẬT)
// =========================================================================
const HISTORICAL_CRAFTING_RECIPES = [
  {
    id: 'CRAFT_CUONG_LINH',
    name: 'Cương Lĩnh Chính Trị Đầu Tiên (1930) Hoàn Chỉnh',
    targetMapId: 'MAP_QUANGTRUONG',
    stationCoord: { x: 10, y: 14 }, // Bảng tin / Bàn trưng bày Quảng Trường
    stationName: 'Bàn Trưng Bày Quảng Trường Ánh Sáng',
    requiredItemIds: ['ITEM_MANH_CUONG_LINH_1', 'ITEM_MANH_CUONG_LINH_2'],
    resultItemId: 'ITEM_CUONG_LINH_HOAN_CHINH',
    desc: 'Ghép nối Mảnh Mục Tiêu Chính Trị và Mảnh Sách Lược Tổ Chức thành [Cương Lĩnh Chính Trị Đầu Tiên Của Đảng 1930] hoàn chỉnh do Bác Hồ khởi thảo!',
    rewardText: '✦ XUẤT SẮC! Cương lĩnh chính trị đầu tiên đã hoàn thành! Cổng tiến vào Căn cứ Pác Bó 1941 đã được mở khóa!'
  },
  {
    id: 'CRAFT_LA_CO',
    name: 'Lá Cờ Đỏ Sao Vàng Khởi Nghĩa Thống Nhất',
    targetMapId: 'MAP_PACBO',
    stationCoord: { x: 10, y: 6 }, // Bàn đá lịch sử Pác Bó (Ven suối phía Tây)
    stationName: 'Bàn Đá Lịch Sử Pác Bó (Suối Lê-nin)',
    requiredItemIds: ['ITEM_MANH_CO_DO_NAM_KY', 'ITEM_NGOI_SAO_PACBO'],
    resultItemId: 'ITEM_LA_CO_TO_QUOC',
    desc: 'May ghép Mảnh Cờ Đỏ Nam Kỳ (1940) và Ngôi Sao Vàng Pác Bó (1941) thành [Lá Cờ Đỏ Sao Vàng Khởi Nghĩa] thống nhất non sông!',
    rewardText: '✦ TUYỆT VỜI! Lá Cờ Tổ Quốc Khởi Nghĩa đã hoàn thành! Cổng tiến vào Chiến khu Tân Trào 1945 đã được mở khóa!'
  },
  {
    id: 'CRAFT_TUYEN_NGON',
    name: 'Bản Tuyên Ngôn Độc Lập (2/9/1945) Hoàn Chỉnh',
    targetMapId: 'MAP_HANOI',
    stationCoord: { x: 16, y: 4 }, // Căn nhà số 48 Hàng Ngang (Chính Bắc)
    stationName: 'Căn Nhà Số 48 Hàng Ngang (Phố Cổ Hà Nội)',
    requiredItemIds: ['ITEM_BAN_THAO_TUYEN_NGON', 'ITEM_BUT_TICH_CHI_DAO'],
    resultItemId: 'ITEM_TUYEN_NGON_HOAN_CHINH',
    desc: 'Hợp nhất Bản Thảo Tân Trào và Bút Tích Chỉ Đạo tại 48 Hàng Ngang thành [Bản Tuyên Ngôn Độc Lập Ngày 2/9/1945] lịch sử!',
    rewardText: '✦ LỊCH SỬ KHẮC GHI! Bản Tuyên Ngôn Độc Lập đã hoàn thành trọn vẹn! Cổng tiến về Đại Lễ Đài Ba Đình đã mở!'
  }
];

export default function App() {
  // Đọc tiến trình đã lưu trong localStorage để chống mất dữ liệu khi rớt mạng / tải lại trang
  const initialSaved = useMemo(() => {
    try {
      const raw = localStorage.getItem('cddl_saved_progress_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // Quản lý map hiện tại (Khôi phục từ localStorage hoặc khởi đầu tại Quảng Trường Ánh Sáng)
  const [currentMapId, setCurrentMapId] = useState(() => {
    const savedMap = initialSaved?.currentMapId;
    return savedMap && MAP_DEFINITIONS[savedMap] ? savedMap : 'MAP_QUANGTRUONG';
  });
  const [mapTransitionText, setMapTransitionText] = useState(null);

  const currentMap = useMemo(() => {
    return MAP_DEFINITIONS[currentMapId] || MAP_DEFINITIONS.MAP_QUANGTRUONG;
  }, [currentMapId]);

  const mapData = useMemo(() => currentMap.generator(), [currentMap]);

  // Tọa độ người chơi mượt mà (Khôi phục tọa độ đã lưu nếu cùng map)
  const initialPos = useMemo(() => {
    if (
      initialSaved?.playerPos &&
      typeof initialSaved.playerPos.x === 'number' &&
      typeof initialSaved.playerPos.y === 'number'
    ) {
      return { x: initialSaved.playerPos.x, y: initialSaved.playerPos.y };
    }
    const m = MAP_DEFINITIONS[initialSaved?.currentMapId] || MAP_DEFINITIONS.MAP_QUANGTRUONG;
    return { ...m.spawn };
  }, [initialSaved]);

  const posRef = useRef(initialPos);
  const lastDisplayPosRef = useRef(initialPos);
  const [playerDisplayPos, setPlayerDisplayPos] = useState(initialPos);
  const dirRef = useRef('down');
  const animStepRef = useRef(0);
  const walkTimerRef = useRef(0);
  const stepAudioTimerRef = useRef(0);
  const alertAudioTimerRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const keysDownRef = useRef({});
  const touchDirRef = useRef(null);

  // Mật thám tuần tra
  const patrolsRef = useRef(JSON.parse(JSON.stringify(currentMap.patrols || [])));

  // Điểm bị phát hiện bởi Mật thám Pháp (0 - 100%) - Tối ưu hiệu năng 60 FPS bằng Ref
  const threatLevelRef = useRef(0);
  const [threatLevel, setThreatLevel] = useState(0);
  const [isPatrolAlerting, setIsPatrolAlerting] = useState(false);
  const [collectedDirectives, setCollectedDirectives] = useState(() =>
    Array.isArray(initialSaved?.collectedDirectives) ? initialSaved.collectedDirectives : []
  );
  const [collectedItems, setCollectedItems] = useState(() =>
    Array.isArray(initialSaved?.collectedItems) ? initialSaved.collectedItems : []
  );
  const [solvedIds, setSolvedIds] = useState(() =>
    Array.isArray(initialSaved?.solvedIds) ? initialSaved.solvedIds : []
  );

  // Vật phẩm rơi ngẫu nhiên trên map sau khi trả lời xong câu hỏi NPC
  const [activeDroppedItem, setActiveDroppedItem] = useState(() =>
    initialSaved?.activeDroppedItem || null
  );

  // Modal khi bị mật thám Pháp bắt (100% Threat)
  const [capturedModal, setCapturedModal] = useState(false);
  const capturedModalRef = useRef(false);

  // Modal khi cổng qua map mới bị khóa
  const [portalBlockedModal, setPortalBlockedModal] = useState(null);

  // Modal khi ghép thành công bảo vật lịch sử
  const [craftSuccessModal, setCraftSuccessModal] = useState(null);

  // Modal cảnh báo khi chưa đủ bảo vật cử hành tại Lễ Đài Ba Đình
  const [podiumWarningModal, setPodiumWarningModal] = useState(null);

  // Mục tiêu kế tiếp (Khôi phục từ localStorage hoặc mặc định là Anh)
  const [currentTargetNpcId, setCurrentTargetNpcId] = useState(() =>
    initialSaved?.currentTargetNpcId && ALL_HISTORICAL_NPCS[initialSaved.currentTargetNpcId]
      ? initialSaved.currentTargetNpcId
      : 'NPC_ANH'
  );

  // Hộp thoại & UI State (Đa câu hỏi)
  const [activeNpc, setActiveNpc] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [puzzleResult, setPuzzleResult] = useState(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  const [relicModal, setRelicModal] = useState(null);
  const [isExpandedScreen, setIsExpandedScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.22); // Zoom to rõ mặc định 122%
  const [soundOn, setSoundOn] = useState(true);
  const [gameStatus, setGameStatus] = useState(() =>
    initialSaved?.gameStatus === 'WON' ? 'WON' : 'PLAYING'
  );
  const [showDirectivesModal, setShowDirectivesModal] = useState(false);
  const [showWorldMapModal, setShowWorldMapModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // =========================================================================
  // HỆ THỐNG ĐUA TOP 60 NGƯỜI & ĐỔI TÊN NHÂN VẬT (MẶC ĐỊNH: HÒ VĂN TÈN)
  // =========================================================================
  // 1. Tên nhân vật (Mặc định 'Hò Văn Tèn', lưu localStorage)
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem('cddl_player_name') || 'Hò Văn Tèn';
    } catch {
      return 'Hò Văn Tèn';
    }
  });

  // 2. ID duy nhất của người chơi
  const [playerId] = useState(() => {
    try {
      let id = localStorage.getItem('cddl_player_id');
      if (!id) {
        id = 'p_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('cddl_player_id', id);
      }
      return id;
    } catch {
      return 'p_' + Math.random().toString(36).substring(2, 9);
    }
  });

  // 3.1. Cấu hình Backend Server URL (Mặc định trỏ thẳng vào Ngrok cố định của bạn)
  const DEFAULT_NGROK_URL = 'https://unattractable-cognoscitively-catheryn.ngrok-free.dev';
  const [backendUrl, setBackendUrl] = useState(() => {
    try {
      localStorage.removeItem('cddl_backend_url');
      const params = new URLSearchParams(window.location.search);
      const queryApi = params.get('api') || params.get('server') || params.get('backend');
      if (queryApi && !queryApi.includes('localhost') && !queryApi.includes('127.0.0.1')) {
        const clean = queryApi.trim().replace(/\/+$/, '');
        localStorage.setItem('cddl_ngrok_be_v3', clean);
        return clean;
      }
      const saved = localStorage.getItem('cddl_ngrok_be_v3');
      if (saved && saved.trim() && !saved.includes('localhost') && !saved.includes('127.0.0.1')) {
        return saved.trim().replace(/\/+$/, '');
      }
      localStorage.setItem('cddl_ngrok_be_v3', DEFAULT_NGROK_URL);
    } catch {}
    return DEFAULT_NGROK_URL;
  });

  // Trạng thái kết nối Backend (Luôn giữ ONLINE để không bao giờ hiện popup chặn người chơi)
  const [backendConnected, setBackendConnected] = useState('ONLINE');
  const [retryTrigger, setRetryTrigger] = useState(0);

  // 3. Tài khoản Admin Host (tk: admin / mk: trienngu) hoặc chạy trực tiếp trên Localhost
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('cddl_admin_auth') === '1';
    } catch {
      return false;
    }
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUserInp, setAdminUserInp] = useState('');
  const [adminPassInp, setAdminPassInp] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  const isHostMachine = useMemo(() => {
    if (isAdminAuthenticated) return true;
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0';
  }, [isAdminAuthenticated]);

  const handleAdminLoginSubmit = (e) => {
    if (e) e.preventDefault();
    if (adminUserInp.trim().toLowerCase() === 'admin' && adminPassInp === 'trienngu') {
      setIsAdminAuthenticated(true);
      try {
        sessionStorage.setItem('cddl_admin_auth', '1');
      } catch {}
      setAdminLoginError('');
      setAdminUserInp('');
      setAdminPassInp('');
      setRoomCode('');
      setShowAdminLoginModal(false);
      setShowHostModal(true);
      SoundEngine.victory();
    } else {
      SoundEngine.wrong();
      setAdminLoginError('Sai tài khoản hoặc mật khẩu Quản trị viên (Host)!');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    try {
      sessionStorage.removeItem('cddl_admin_auth');
    } catch {}
    setShowHostModal(false);
  };

  // 3.2. Tên miền Giao diện Frontend (https://conduongdoclap.vercel.app)
  const [frontendDomain, setFrontendDomain] = useState(() => {
    try {
      const h = window.location.hostname;
      if (h !== 'localhost' && h !== '127.0.0.1') {
        return window.location.origin;
      }
    } catch {}
    return 'https://conduongdoclap.vercel.app';
  });

  // Helper an toàn tạo URL gọi API (Ưu tiên gọi trực tiếp localhost:4000 nếu đang ở máy Host để tiết kiệm 100% băng thông Ngrok cho người chơi từ xa)
  const getApiUrl = useCallback((endpoint) => {
    const ep = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    try {
      const h = window.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        return `http://localhost:4000${ep}`;
      }
    } catch {}
    if (!backendUrl) return `${DEFAULT_NGROK_URL}${ep}`;
    const base = backendUrl.trim().replace(/\/+$/, '');
    return `${base}${ep}`;
  }, [backendUrl]);

  // 4. Mã phòng của Người chơi (tự động nhận từ ?room=XYZ hoặc khôi phục từ localStorage khi mất mạng/F5)
  const [roomCode, setRoomCode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQr = params.get('room');
      if (fromQr && fromQr.trim()) return fromQr.trim().toUpperCase();
      if (initialSaved?.roomCode && typeof initialSaved.roomCode === 'string') {
        return initialSaved.roomCode.trim().toUpperCase();
      }
      return '';
    } catch {
      return '';
    }
  });
  // Mã phòng riêng của trang Quản trị (Admin/Host) - Tách biệt hoàn toàn để Admin không bị tính là người chơi
  const [hostRoomCode, setHostRoomCode] = useState('DOCLAP');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Hàm xử lý khi người chơi nhập mã code trên thanh Navbar và bấm "Vào Phòng"
  const handlePlayerJoinByCode = (e) => {
    if (e) e.preventDefault();
    const cleanCode = (joinCodeInput || '').trim().toUpperCase();
    if (!cleanCode) return;
    SoundEngine.interact();
    setRoomCode(cleanCode);
    setJoinCodeInput('');
  };

  // Hàm rời phòng hiện tại để nhập mã phòng khác
  const handleLeaveRoom = () => {
    SoundEngine.interact();
    setRoomCode('');
    setRaceRoomData(null);
    syncedStartTimeRef.current = null;
  };

  // 5. Trạng thái phòng đua & Bảng xếp hạng
  const [raceRoomData, setRaceRoomData] = useState(null);
  const [myRankInRoom, setMyRankInRoom] = useState(1);
  const [totalPlayersInRoom, setTotalPlayersInRoom] = useState(1);
  const [raceElapsedSeconds, setRaceElapsedSeconds] = useState(0);
  const [raceCountdown, setRaceCountdown] = useState(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showProjectorMode, setShowProjectorMode] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [lanInfo, setLanInfo] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [finishTimeMsRecord, setFinishTimeMsRecord] = useState(() =>
    initialSaved?.finishTimeMsRecord || null
  );
  const raceStartSeenRef = useRef(false);
  // Lưu dấu mốc startTime của ván đua hiện tại để phân biệt reconnect cùng ván vs Admin bấm Bắt Đầu ván mới
  const syncedStartTimeRef = useRef(initialSaved?.syncedStartTime || null);

  // Hàm ép toàn bộ tiến trình người chơi quay về điểm xuất phát (khi Admin bấm Bắt Đầu hoặc Đặt Lại)
  const resetPlayerForNewRaceSession = useCallback((newStartTime) => {
    syncedStartTimeRef.current = newStartTime || null;
    const startSpawn = { ...MAP_DEFINITIONS.MAP_QUANGTRUONG.spawn };
    setCurrentMapId('MAP_QUANGTRUONG');
    posRef.current = startSpawn;
    lastDisplayPosRef.current = startSpawn;
    setPlayerDisplayPos(startSpawn);
    patrolsRef.current = JSON.parse(JSON.stringify(MAP_DEFINITIONS.MAP_QUANGTRUONG.patrols || []));
    dirRef.current = 'down';
    threatLevelRef.current = 0;
    setThreatLevel(0);
    setIsPatrolAlerting(false);
    setCollectedDirectives([]);
    setCollectedItems([]);
    setSolvedIds([]);
    setActiveDroppedItem(null);
    setCapturedModal(false);
    capturedModalRef.current = false;
    setCurrentTargetNpcId('NPC_ANH');
    setActiveNpc(null);
    setCurrentQuestionIdx(0);
    setPuzzleResult(null);
    setRelicModal(null);
    setCraftSuccessModal(null);
    setPortalBlockedModal(null);
    setPodiumWarningModal(null);
    setFinishTimeMsRecord(null);
    setGameStatus('PLAYING');

    try {
      localStorage.setItem(
        'cddl_saved_progress_v1',
        JSON.stringify({
          roomCode,
          syncedStartTime: newStartTime || null,
          currentMapId: 'MAP_QUANGTRUONG',
          playerPos: startSpawn,
          solvedIds: [],
          collectedItems: [],
          collectedDirectives: [],
          currentTargetNpcId: 'NPC_ANH',
          activeDroppedItem: null,
          gameStatus: 'PLAYING',
          finishTimeMsRecord: null,
          updatedAt: Date.now()
        })
      );
    } catch {}
  }, [roomCode]);

  // Tự động lưu tiến trình chơi vào localStorage mỗi khi có thay đổi (chống mất dữ liệu khi disconnect / F5)
  useEffect(() => {
    try {
      const progressData = {
        roomCode,
        syncedStartTime: syncedStartTimeRef.current,
        currentMapId,
        playerPos: posRef.current,
        solvedIds,
        collectedItems,
        collectedDirectives,
        currentTargetNpcId,
        activeDroppedItem,
        gameStatus,
        finishTimeMsRecord,
        updatedAt: Date.now()
      };
      localStorage.setItem('cddl_saved_progress_v1', JSON.stringify(progressData));
    } catch {}
  }, [
    roomCode,
    currentMapId,
    playerDisplayPos,
    solvedIds,
    collectedItems,
    collectedDirectives,
    currentTargetNpcId,
    activeDroppedItem,
    gameStatus,
    finishTimeMsRecord
  ]);

  const canvasRef = useRef(null);
  const imagesRef = useRef({});
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Danh sách NPC của map hiện tại
  const mapNpcs = useMemo(() => {
    return Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
  }, [currentMapId]);

  // Kiểm tra tất cả NPC của map hiện tại đã hoàn thành hay chưa
  const isCurMapAllNpcsSolved = useMemo(() => {
    return mapNpcs.length > 0 && mapNpcs.every((n) => solvedIds.includes(n.id));
  }, [mapNpcs, solvedIds]);

  // NPC chưa giải tiếp theo trong map hiện tại
  const nextUnsolvedNpcInMap = useMemo(() => {
    return mapNpcs.find((n) => !solvedIds.includes(n.id)) || null;
  }, [mapNpcs, solvedIds]);

  // Cổng tiến lên map tiếp theo
  const forwardNextPortal = useMemo(() => {
    const curDef = MAP_DEFINITIONS[currentMapId];
    return currentMap.portals.find((p) => {
      const targetDef = MAP_DEFINITIONS[p.targetMapId];
      return targetDef && curDef && targetDef.chapterNum > curDef.chapterNum;
    }) || currentMap.portals[0];
  }, [currentMap, currentMapId]);

  // Preload toàn bộ assets
  useEffect(() => {
    const assetManifest = {
      // Tiles
      tileGrass: '/assets/tiles/tile-grass.png',
      tileGrassPlaza: '/assets/tiles/tile-grass-plaza.png',
      tilePath: '/assets/tiles/tile-path.png',
      tileCurbTop: '/assets/tiles/tile-curb-top.png',
      tileCity: '/assets/tiles/tile-city.png',
      tileForest: '/assets/tiles/tile-forest.png',
      tileWater: '/assets/tiles/tile-water.png',
      tileRocky: '/assets/tiles/tile-rocky.png',

      // Props
      pedestalStone: '/assets/props/pedestal-stone.png',
      exhibitKiosk: '/assets/props/exhibit-kiosk.png',
      propPodiumMuseum: '/assets/props/prop-podium-museum.png',
      propTreeChibi: '/assets/props/prop-tree-chibi.png',
      propCliffRock: '/assets/props/prop-cliff-rock.png',
      propTreePine: '/assets/props/prop-tree-pine.png',
      propTreePalm: '/assets/props/prop-tree-palm.png',
      propBuildingHanoi: '/assets/props/prop-building-hanoi.png',
      propStreetLamp: '/assets/props/prop-street-lamp.png',
      propHouseThatch: '/assets/props/prop-house-thatch.png',
      propBridgeWood: '/assets/props/prop-bridge-wood.png',
      propPodiumBaDinh: '/assets/props/prop-podium-badinh.png',
      propTempleDinh: '/assets/props/prop-temple-dinh.png',
      banyanTree: '/assets/props/banyan-tree.png',
      stoneTable: '/assets/props/stone-table.png',
      flagpoleRedStar: '/assets/props/flagpole-redstar.png',

      // Player Chibi Walk Frames (HD 48x64)
      player_down: '/assets/sprites/player-down.png',
      player_down_walk1: '/assets/sprites/player-down-walk1.png',
      player_down_walk2: '/assets/sprites/player-down-walk2.png',
      player_up: '/assets/sprites/player-up.png',
      player_up_walk1: '/assets/sprites/player-up-walk1.png',
      player_up_walk2: '/assets/sprites/player-up-walk2.png',
      player_left: '/assets/sprites/player-left.png',
      player_left_walk1: '/assets/sprites/player-left-walk1.png',
      player_left_walk2: '/assets/sprites/player-left-walk2.png',
      player_right: '/assets/sprites/player-right.png',
      player_right_walk1: '/assets/sprites/player-right-walk1.png',
      player_right_walk2: '/assets/sprites/player-right-walk2.png',

      // 8 Thành viên nhóm CON ĐƯỜNG ĐỘC LẬP (Đầy đủ sprite tùy biến)
      npcAnh: '/assets/sprites/npc-anh.png',
      npcBinh: '/assets/sprites/npc-binh.png',
      npcLinh: '/assets/sprites/npc-linh.png',
      npcNgoc: '/assets/sprites/npc-ngoc.png',
      npcDung: '/assets/sprites/npc-dung.png',
      npcKhanh: '/assets/sprites/npc-khanh.png',
      npcDuc: '/assets/sprites/npc-duc.png',
      npcHung: '/assets/sprites/npc-hung.png',

      // Nhân vật khảo cứu khác & NPC hỗ trợ
      npcPhuong: '/assets/sprites/npc-phuong.png',
      npcBao: '/assets/sprites/npc-bao.png',
      npcNam: '/assets/sprites/npc-nam.png',
      npcLan: '/assets/sprites/npc-lan.png',
      npcTrong: '/assets/sprites/npc-trong.png',

      // 12 Nhân vật lịch sử CON ĐƯỜNG ĐỘC LẬP
      npcBacHo: '/assets/sprites/npc-bac-ho.png',
      npcVoNguyenGiap: '/assets/sprites/npc-vo-nguyen-giap.png',
      npcTranPhu: '/assets/sprites/npc-tran-phu.png',
      npcNhaBao: '/assets/sprites/npc-nha-bao.png',
      npcMaBay: '/assets/sprites/npc-ma-bay.png',
      npcTruongChinh: '/assets/sprites/npc-truong-chinh.png',
      npcLeHongPhong: '/assets/sprites/npc-le-hong-phong.png',
      npcNguyenVanCu: '/assets/sprites/npc-nguyen-van-cu.png',
      npcHaHuyTap: '/assets/sprites/npc-ha-huy-tap.png',
      npcHoangVanThu: '/assets/sprites/npc-hoang-van-thu.png',
      npcKimDong: '/assets/sprites/npc-kim-dong.png',
      patrolAgent: '/assets/sprites/patrol-agent.png'
    };

    let count = 0;
    const total = Object.keys(assetManifest).length;
    Object.entries(assetManifest).forEach(([k, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imagesRef.current[k] = img;
        count++;
        if (count >= total) setAssetsLoaded(true);
      };
      img.onerror = () => {
        count++;
        if (count >= total) setAssetsLoaded(true);
      };
    });
  }, []);

  // Chuyển map (Change Map) - Kiểm tra điều kiện mở khóa map mới
  const switchMap = (targetMapId, spawnCoord) => {
    const curMapDef = MAP_DEFINITIONS[currentMapId];
    const targetMapDef = MAP_DEFINITIONS[targetMapId];
    const isAdvancing = targetMapDef && targetMapDef.chapterNum > curMapDef.chapterNum;

    if (isAdvancing) {
      const currentChapterNpcs = Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
      const allSolved = currentChapterNpcs.every((n) => solvedIds.includes(n.id));
      const isItemClear = activeDroppedItem === null;

      // Kiểm tra bảo vật yêu cầu ghép của từng cổng tiến lên phía trước:
      let requiredCraftItem = null;
      let craftHint = '';

      if (currentMapId === 'MAP_QUANGTRUONG' && targetMapId === 'MAP_PACBO') {
        requiredCraftItem = 'ITEM_CUONG_LINH_HOAN_CHINH';
        craftHint = 'Bạn cần ghép 2 Mảnh Cương Lĩnh thành [Cương Lĩnh Chính Trị Đầu Tiên 1930 Hoàn Chỉnh] tại Bàn Trưng Bày Quảng Trường Ánh Sáng!';
      } else if (currentMapId === 'MAP_BADIEM' && targetMapId === 'MAP_TANTRAO') {
        requiredCraftItem = 'ITEM_LA_CO_TO_QUOC';
        craftHint = 'Bạn cần quay về Bàn Đá Lịch Sử Pác Bó (Suối Lê-nin) để may ghép [Lá Cờ Đỏ Sao Vàng Khởi Nghĩa Thống Nhất] trước khi lên Tân Trào!';
      } else if (currentMapId === 'MAP_TANTRAO' && targetMapId === 'MAP_BADINH') {
        requiredCraftItem = 'ITEM_TUYEN_NGON_HOAN_CHINH';
        craftHint = 'Bạn cần quay về Căn Nhà 48 Hàng Ngang (Hà Nội) để hợp nhất [Bản Tuyên Ngôn Độc Lập 2/9/1945 Hoàn Chỉnh] trước khi về Ba Đình!';
      }

      const hasRequiredCraft = !requiredCraftItem || collectedItems.includes(requiredCraftItem);
      const isComplete = allSolved && isItemClear && hasRequiredCraft;

      if (!isComplete) {
        SoundEngine.wrong();
        setPortalBlockedModal({
          targetTitle: targetMapDef.title,
          solvedCount: currentChapterNpcs.filter((n) => solvedIds.includes(n.id)).length,
          totalCount: currentChapterNpcs.length,
          hasPendingItem: activeDroppedItem !== null,
          craftHint: !hasRequiredCraft ? craftHint : null
        });
        return;
      }
    }

    SoundEngine.warp();
    setMapTransitionText(MAP_DEFINITIONS[targetMapId]?.title || 'ĐANG CHUYỂN CHIẾN KHU...');
    setTimeout(() => {
      setCurrentMapId(targetMapId);
      const nextMap = MAP_DEFINITIONS[targetMapId] || MAP_DEFINITIONS.MAP_QUANGTRUONG;
      const sp = spawnCoord || nextMap.spawn;
      posRef.current = { x: sp.x, y: sp.y };
      lastDisplayPosRef.current = { x: sp.x, y: sp.y };
      setPlayerDisplayPos({ x: sp.x, y: sp.y });
      patrolsRef.current = JSON.parse(JSON.stringify(nextMap.patrols || []));

      // Tự động chuyển target sang NPC đầu tiên của map mới nếu chưa giải
      const nextMapNpcs = Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === targetMapId);
      const remainingInNext = nextMapNpcs.filter((n) => !solvedIds.includes(n.id));
      if (remainingInNext.length > 0) {
        setCurrentTargetNpcId(remainingInNext[0].id);
      }

      setTimeout(() => setMapTransitionText(null), 600);
    }, 400);
  };

  // Hàm tạo vị trí rơi vật phẩm ngẫu nhiên trên bản đồ hiện tại
  const dropRandomItemOnMap = (npcId, mapId) => {
    const itemInfo = MILESTONE_DROPS[npcId] || {
      id: 'ITEM_' + npcId,
      name: 'Mảnh Tài Liệu Lịch Sử',
      desc: 'Hiện vật lịch sử quý giá của phong trào cách mạng.',
      icon: 'star'
    };

    let rx = 10, ry = 10;
    let attempts = 0;
    const currentMapDef = MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS.MAP_QUANGTRUONG;
    const mapGrid = currentMapDef.generator();

    while (attempts < 60) {
      attempts++;
      rx = Math.floor(4 + Math.random() * (MAP_WIDTH - 8));
      ry = Math.floor(5 + Math.random() * (MAP_HEIGHT - 9));
      const tile = mapGrid[ry][rx];
      const isWalkable = tile === TILES.GRASS || tile === TILES.GRASS_PLAZA || tile === TILES.PATH || tile === TILES.MUSEUM_FLOOR;
      const distToPlayer = Math.hypot(rx - posRef.current.x, ry - posRef.current.y);
      if (isWalkable && distToPlayer >= 4) {
        break;
      }
    }

    return {
      ...itemInfo,
      npcId,
      x: rx,
      y: ry,
      mapId
    };
  };

  // Chơi lại map hiện tại khi bị mật thám bắt (100% điểm phát hiện)
  const handleRestartMap = () => {
    SoundEngine.interact();
    capturedModalRef.current = false;
    setCapturedModal(false);

    // Đưa người chơi về điểm xuất phát của map hiện tại
    const curMapDef = MAP_DEFINITIONS[currentMapId] || MAP_DEFINITIONS.MAP_QUANGTRUONG;
    posRef.current = { ...curMapDef.spawn };
    lastDisplayPosRef.current = { ...curMapDef.spawn };
    setPlayerDisplayPos({ ...curMapDef.spawn });
    dirRef.current = 'down';

    // Đặt lại điểm phát hiện về 0
    threatLevelRef.current = 0;
    setThreatLevel(0);
    setIsPatrolAlerting(false);

    // Xóa vật phẩm đang rơi chưa nhặt
    setActiveDroppedItem(null);

    // Đặt lại các nhiệm vụ trong map hiện tại để chơi lại từ đầu
    const curMapNpcIds = Object.values(ALL_HISTORICAL_NPCS)
      .filter((n) => n.mapId === currentMapId)
      .map((n) => n.id);

    setSolvedIds((prev) => prev.filter((id) => !curMapNpcIds.includes(id)));

    // Đặt lại mục tiêu là NPC đầu tiên của map
    if (curMapNpcIds.length > 0) {
      setCurrentTargetNpcId(curMapNpcIds[0]);
    }

    // Reset lại mật thám
    patrolsRef.current = JSON.parse(JSON.stringify(curMapDef.patrols || []));
  };

  // Xác định NPC mục tiêu hiện tại
  const targetNpc = useMemo(() => {
    return ALL_HISTORICAL_NPCS[currentTargetNpcId] || ALL_HISTORICAL_NPCS.NPC_ANH;
  }, [currentTargetNpcId]);

  // Khoảng cách tới mục tiêu (nếu cùng map)
  const isTargetInSameMap = targetNpc.mapId === currentMapId;
  const distanceToTarget = useMemo(() => {
    if (!isTargetInSameMap) return null;
    const dist = Math.hypot(targetNpc.x - playerDisplayPos.x, targetNpc.y - playerDisplayPos.y);
    return Math.max(1, Math.round(dist));
  }, [playerDisplayPos, targetNpc, isTargetInSameMap]);

  // NPC đứng gần nhất để tương tác (Bán kính 1.45 ô chặt chẽ, ưu tiên NPC mục tiêu đang cần làm nhiệm vụ)
  const nearbyNpc = useMemo(() => {
    const candidates = mapNpcs
      .map((npc) => ({ npc, dist: Math.hypot(npc.x - playerDisplayPos.x, npc.y - playerDisplayPos.y) }))
      .filter((c) => c.dist <= 1.45);
    if (candidates.length === 0) return null;

    // Ưu tiên NPC mục tiêu hiện tại nếu nằm trong phạm vi tương tác
    const activeTargetId = nextUnsolvedNpcInMap ? nextUnsolvedNpcInMap.id : currentTargetNpcId;
    const targetCandidate = candidates.find((c) => c.npc.id === activeTargetId);
    if (targetCandidate) return targetCandidate.npc;

    // Nếu không có NPC mục tiêu trong tầm, chọn NPC đứng sát nhất
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0].npc;
  }, [playerDisplayPos, mapNpcs, nextUnsolvedNpcInMap, currentTargetNpcId]);

  // Cổng dịch chuyển gần nhất (Bán kính 1.5 ô)
  const nearbyPortal = useMemo(() => {
    return currentMap.portals.find((p) => {
      const dist = Math.hypot(p.x - playerDisplayPos.x, p.y - playerDisplayPos.y);
      return dist <= 1.5;
    });
  }, [playerDisplayPos, currentMap]);

  // Trạm ghép vật phẩm của map hiện tại (nếu có)
  const currentMapRecipe = useMemo(() => {
    return HISTORICAL_CRAFTING_RECIPES.find((r) => r.targetMapId === currentMapId);
  }, [currentMapId]);

  // Kiểm tra người chơi có đang đứng gần trạm ghép hay không (Bán kính 1.5 ô)
  const nearbyCraftStation = useMemo(() => {
    if (!currentMapRecipe) return null;
    const dist = Math.hypot(
      currentMapRecipe.stationCoord.x - playerDisplayPos.x,
      currentMapRecipe.stationCoord.y - playerDisplayPos.y
    );
    return dist <= 1.5 ? currentMapRecipe : null;
  }, [currentMapRecipe, playerDisplayPos]);

  // Kiểm tra có đủ nguyên liệu để ghép hay không
  const hasCraftMaterials = (recipe) => {
    if (!recipe) return false;
    return recipe.requiredItemIds.every((id) => collectedItems.includes(id));
  };

  const isCraftCompleted = (recipe) => {
    if (!recipe) return false;
    return collectedItems.includes(recipe.resultItemId);
  };

  // Công thức hiện tại đã đủ nguyên liệu nhưng chưa ghép
  const readyCraftRecipe = useMemo(() => {
    return HISTORICAL_CRAFTING_RECIPES.find((r) => {
      const hasAll = r.requiredItemIds.every((id) => collectedItems.includes(id));
      const notDone = !collectedItems.includes(r.resultItemId);
      return hasAll && notDone;
    });
  }, [collectedItems]);

  // Đứng gần Bục Lễ Đài Ba Đình (Quảng Trường Ba Đình - Bán kính 1.5 ô chuẩn xác)
  const nearbyBaDinhPodium = useMemo(() => {
    if (currentMapId !== 'MAP_BADINH') return false;
    const dist = Math.hypot(16 - playerDisplayPos.x, 6 - playerDisplayPos.y);
    return dist <= 1.5;
  }, [currentMapId, playerDisplayPos]);

  // Xử lý ghép vật phẩm tại trạm
  const handleCraftAtStation = (recipe) => {
    if (!recipe) return;
    if (isCraftCompleted(recipe)) {
      setRelicModal({
        title: 'BẢO VẬT ĐÃ HOÀN THÀNH',
        name: recipe.name,
        desc: `Bạn đã hoàn tất ghép [${recipe.name}] rồi! Bảo vật này đang được lưu giữ trang trọng trong hành trang của bạn.`
      });
      return;
    }

    if (!hasCraftMaterials(recipe)) {
      const missing = recipe.requiredItemIds.filter((id) => !collectedItems.includes(id));
      setRelicModal({
        title: 'CHƯA ĐỦ NGUYÊN LIỆU GHÉP!',
        name: recipe.name,
        desc: `Để ghép bảo vật này tại [${recipe.stationName}], bạn cần thu thập đủ:\n${recipe.desc}\n\nHiện bạn còn thiếu ${missing.length} mảnh nguyên liệu lịch sử!`
      });
      return;
    }

    // Ghép thành công
    SoundEngine.victory();
    setCollectedItems((prev) => [...prev, recipe.resultItemId]);
    setCraftSuccessModal(recipe);
  };

  // Tab hiển thị trong màn hình Admin Host ('AUTO' tự động hiện QR khi WAITING và BXH khi RACING, hoặc chuyển tay)
  const [hostTabMode, setHostTabMode] = useState('AUTO');

  // Tạo URL tham gia thuần túy (KHÔNG gọi setState trong lúc render để tránh vòng lặp vô tận gây crash)
  const buildJoinRoomUrl = useCallback((targetCode, customApi, customFe) => {
    const code = (targetCode || roomCode || 'DOCLAP').trim().toUpperCase();
    const fe = (customFe !== undefined ? customFe : (frontendDomain || 'https://conduongdoclap.vercel.app')).trim().replace(/\/+$/, '');
    const api = customApi !== undefined ? customApi : backendUrl;

    let fullUrl = `${fe}/?room=${encodeURIComponent(code)}`;
    if (api && api.trim()) {
      fullUrl += `&api=${encodeURIComponent(api.trim().replace(/\/+$/, ''))}`;
    }
    return fullUrl;
  }, [roomCode, frontendDomain, backendUrl]);

  const currentJoinRoomUrl = useMemo(() => {
    return buildJoinRoomUrl(hostRoomCode || 'DOCLAP', backendUrl, frontendDomain);
  }, [buildJoinRoomUrl, hostRoomCode, backendUrl, frontendDomain]);

  // Chỉ sinh ảnh QR Code bên trong useEffect khi currentJoinRoomUrl thay đổi
  useEffect(() => {
    let isCancelled = false;
    QRCode.toDataURL(currentJoinRoomUrl, {
      width: 340,
      margin: 2,
      color: { dark: '#1a0505', light: '#ffffff' }
    })
      .then((url) => {
        if (!isCancelled) setQrCodeDataUrl(url);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [currentJoinRoomUrl]);

  // Lấy thông tin LAN IP cho Host khi khởi động (Dùng POST text/plain để bỏ qua 100% CORS Preflight OPTIONS và màn hình chặn của Ngrok)
  useEffect(() => {
    if (!isHostMachine) return;
    let isCancelled = false;
    fetch(getApiUrl('/api/race/info'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: '{}'
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isCancelled && data) setLanInfo(data);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [isHostMachine, getApiUrl]);

  // Lưu tham chiếu dữ liệu mới nhất vào Ref để vòng lặp đồng bộ không bị hủy/khởi tạo lại liên tục khi người chơi di chuyển hoặc giải đố
  const syncStateRef = useRef({});
  useEffect(() => {
    syncStateRef.current = {
      roomCode,
      showHostModal,
      isAdminAuthenticated,
      playerId,
      playerName: (playerName || 'Hò Văn Tèn').trim(),
      currentMapId,
      currentMapName: currentMap?.title?.replace('HÀNH TRÌNH: ', '') || 'Chiến khu',
      solvedCount: solvedIds.length,
      isFinished: gameStatus === 'WON',
      finishTimeMs: finishTimeMsRecord,
      resetPlayerForNewRaceSession
    };
  }, [
    roomCode,
    showHostModal,
    isAdminAuthenticated,
    playerId,
    playerName,
    currentMapId,
    currentMap,
    solvedIds.length,
    gameStatus,
    finishTimeMsRecord,
    resetPlayerForNewRaceSession
  ]);

  // Đồng bộ nhịp tim (Heartbeat sync) siêu ổn định qua Ngrok (POST text/plain Simple Request: 0 OPTIONS preflight, không bao giờ hiện popup chặn)
  useEffect(() => {
    let isCancelled = false;
    let timeoutId = null;

    const syncWithRoom = async () => {
      if (isCancelled) return;
      const st = syncStateRef.current;

      // Nếu đang mở bảng Quản trị hoặc là tài khoản Admin, hoặc chưa nhập mã phòng: không cần gửi heartbeat người chơi
      if (st.showHostModal || st.isAdminAuthenticated || !st.roomCode || !st.roomCode.trim()) {
        if (!isCancelled) {
          timeoutId = setTimeout(syncWithRoom, 2500);
        }
        return;
      }

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 7000);

      try {
        const payload = {
          roomCode: st.roomCode,
          playerId: st.playerId,
          playerName: st.playerName,
          currentMapId: st.currentMapId,
          currentMapName: st.currentMapName,
          solvedCount: st.solvedCount,
          totalPieces: 8,
          isFinished: st.isFinished,
          finishTimeMs: st.finishTimeMs,
          clientStartTime: syncedStartTimeRef.current
        };

        const res = await fetch(getApiUrl('/api/race/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (!isCancelled && data.success) {
            setMyRankInRoom((prev) => (prev !== (data.rank || 1) ? (data.rank || 1) : prev));
            setTotalPlayersInRoom((prev) => (prev !== (data.totalPlayers || 1) ? (data.totalPlayers || 1) : prev));

            if (data.roomStatus === 'RACING' && data.startTime) {
              const diffSec = Math.floor((Date.now() - data.startTime) / 1000);
              setRaceElapsedSeconds(Math.max(0, diffSec));

              // NẾU ADMIN VỪA BẤM BẮT ĐẦU VÁN MỚI (startTime của phòng khác với syncedStartTime của máy):
              // Lập tức reset toàn bộ tiến trình của người chơi về vạch xuất phát ban đầu!
              if (syncedStartTimeRef.current !== data.startTime) {
                st.resetPlayerForNewRaceSession?.(data.startTime);
                SoundEngine.victory();
                setRaceCountdown('BẮT ĐẦU PHẦN THI!');
                setTimeout(() => setRaceCountdown(null), 2500);
              }
            } else if (data.roomStatus === 'WAITING') {
              setRaceElapsedSeconds(0);
              // Nếu trước đó đang trong một ván đua mà Admin bấm Đặt lại (RESET về WAITING) -> Reset người chơi về đầu
              if (syncedStartTimeRef.current !== null) {
                st.resetPlayerForNewRaceSession?.(null);
              }
            }
          }
        }
      } catch (e) {
      } finally {
        clearTimeout(abortTimer);
        if (!isCancelled) {
          timeoutId = setTimeout(syncWithRoom, 2200);
        }
      }
    };

    syncWithRoom();
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [backendUrl, getApiUrl, retryTrigger, roomCode]);

  // Bộ đếm thời gian thi đấu tăng mỗi giây khi trạng thái RACING
  useEffect(() => {
    let timer;
    if (raceRoomData?.status === 'RACING' && raceRoomData?.startTime) {
      timer = setInterval(() => {
        setRaceElapsedSeconds(Math.max(0, Math.floor((Date.now() - raceRoomData.startTime) / 1000)));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [raceRoomData?.status, raceRoomData?.startTime]);

  // Host & Người chơi tải Leaderboard 60 người không chồng chéo (Non-overlapping poll qua POST text/plain)
  useEffect(() => {
    if (!showHostModal && !showProjectorMode && !showJoinModal) return;
    let isCancelled = false;
    let timerId = null;

    const fetchHostRoom = async () => {
      if (isCancelled) return;
      const controller = new AbortController();
      const abortId = setTimeout(() => controller.abort(), 6000);
      try {
        const targetRoom = showHostModal || showProjectorMode ? (hostRoomCode || 'DOCLAP') : (roomCode || 'DOCLAP');
        const hostIdVal = showHostModal || isAdminAuthenticated ? playerId : '';
        const res = await fetch(getApiUrl('/api/race/room'), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ code: targetRoom, hostId: hostIdVal }),
          signal: controller.signal
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (!isCancelled && data.success && data.room) {
            setRaceRoomData(data.room);
          }
        }
      } catch (e) {
      } finally {
        clearTimeout(abortId);
        if (!isCancelled) {
          timerId = setTimeout(fetchHostRoom, 2000);
        }
      }
    };

    fetchHostRoom();
    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [showHostModal, showProjectorMode, showJoinModal, roomCode, hostRoomCode, isAdminAuthenticated, playerId, getApiUrl]);

  // Host phát lệnh Bắt đầu cuộc đua -> Tự động chuyển màn hình Admin sang Bảng Xếp Hạng Top 1 -> Hết
  const handleHostStartRace = async () => {
    try {
      SoundEngine.victory();
      setHostTabMode('LIVE_RANKING');
      setRaceCountdown('3... 2... 1... BẮT ĐẦU! 🚀');
      setTimeout(() => setRaceCountdown(null), 3000);

      const res = await fetch(getApiUrl('/api/race/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ roomCode: hostRoomCode, action: 'START' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRaceRoomData(data.room);
      }
    } catch (e) {
      console.error('Lỗi khởi động đua:', e);
    }
  };

  // Host làm mới / Reset cuộc đua -> Quay lại sảnh QR Code
  const handleHostResetRace = async () => {
    try {
      setHostTabMode('LOBBY_QR');
      const res = await fetch(getApiUrl('/api/race/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ roomCode: hostRoomCode, action: 'RESET' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRaceRoomData(data.room);
        setFinishTimeMsRecord(null);
        setRaceElapsedSeconds(0);
      }
    } catch (e) {
      console.error('Lỗi reset phòng:', e);
    }
  };

  // Host kết thúc cuộc đua
  const handleHostEndRace = async () => {
    try {
      setHostTabMode('LIVE_RANKING');
      const res = await fetch(getApiUrl('/api/race/action'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ roomCode: hostRoomCode, action: 'END' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRaceRoomData(data.room);
      }
    } catch (e) {
      console.error('Lỗi kết thúc đua:', e);
    }
  };

  // Host tạo phòng mới
  const handleCreateNewRoom = async (newCode) => {
    const code = (newCode || 'DOCLAP').trim().toUpperCase();
    if (!code) return;
    try {
      setHostRoomCode(code);
      setCustomRoomInput('');
      setHostTabMode('LOBBY_QR');
      const res = await fetch(getApiUrl('/api/race/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ roomCode: code, maxPlayers: 60 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRaceRoomData(data.room);
      }
    } catch (e) {
      console.error('Lỗi tạo phòng:', e);
    }
  };

  // Sao chép link tham gia
  const handleCopyJoinLink = () => {
    navigator.clipboard?.writeText(currentJoinRoomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Format thời gian mm:ss
  const formatRaceTime = (secondsOrMs) => {
    if (!secondsOrMs && secondsOrMs !== 0) return '--:--';
    const totalSec = secondsOrMs > 100000 ? Math.floor(secondsOrMs / 1000) : Math.floor(secondsOrMs);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Xử lý Cử Hành Đại Lễ Tuyên Ngôn Độc Lập tại Ba Đình
  const handleTriggerBaDinhCeremony = () => {
    const hasTuyenNgon = collectedItems.includes('ITEM_TUYEN_NGON_HOAN_CHINH');
    const hasLaCo = collectedItems.includes('ITEM_LA_CO_TO_QUOC');

    if (hasTuyenNgon && hasLaCo) {
      SoundEngine.victory();
      const now = Date.now();
      const finishMs = raceRoomData?.startTime ? Math.max(1000, now - raceRoomData.startTime) : (raceElapsedSeconds * 1000 || 180000);
      setFinishTimeMsRecord(finishMs);
      setGameStatus('WON');

      // Gửi ngay kết quả về đích lên server
      fetch(getApiUrl('/api/race/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          roomCode,
          playerId,
          playerName: (playerName || 'Hò Văn Tèn').trim(),
          currentMapId: 'map-5-ba-dinh',
          currentMapName: 'Lễ Đài Ba Đình (1945)',
          solvedCount: 8,
          totalPieces: 8,
          isFinished: true,
          finishTimeMs: finishMs,
          clientStartTime: syncedStartTimeRef.current
        })
      }).catch(() => {});
    } else {
      SoundEngine.wrong();
      setPodiumWarningModal({
        missingTuyenNgon: !hasTuyenNgon,
        missingLaCo: !hasLaCo
      });
    }
  };

  // Lắng nghe bàn phím (Bỏ qua khi người chơi đang gõ trong ô input)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysDownRef.current[e.key.toLowerCase()] = true;

      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
        if (nearbyNpc && !activeNpc) {
          // Nếu đang có vật phẩm rơi cần đi tìm trước:
          if (activeDroppedItem) {
            SoundEngine.alert();
            setRelicModal({
              title: 'CẦN TÌM KỶ VẬT TRƯỚC!',
              name: activeDroppedItem.name,
              desc: `Bạn cần tìm và thu thập [${activeDroppedItem.name}] đang ẩn giấu trên bản đồ trước khi tiếp tục nhiệm vụ tiếp theo! Hãy lần theo mũi tên vàng dẫn đường to rõ nhé!`,
              isDropAlert: true
            });
            return;
          }

          // Kiểm tra xem NPC này có phải là mục tiêu tuần tự hiện tại hay không:
          const currentTargetId = nextUnsolvedNpcInMap ? nextUnsolvedNpcInMap.id : currentTargetNpcId;
          if (nearbyNpc.id !== currentTargetId && !solvedIds.includes(nearbyNpc.id)) {
            SoundEngine.alert();
            const expectedName = nextUnsolvedNpcInMap ? nextUnsolvedNpcInMap.name : targetNpc.name;
            setRelicModal({
              title: 'CHƯA ĐẾN LƯỢT NHIỆM VỤ!',
              name: nearbyNpc.name,
              desc: `Hãy hoàn thành nhiệm vụ cùng ${expectedName} và tìm kỷ vật trước khi trao đổi cùng ${nearbyNpc.name}!`,
              isDropAlert: true
            });
            return;
          }

          SoundEngine.interact();
          setActiveNpc(nearbyNpc);
          setCurrentQuestionIdx(0);
          setPuzzleResult(null);
          setSelectedOptionIdx(null);
        } else if (nearbyBaDinhPodium) {
          handleTriggerBaDinhCeremony();
        } else if (nearbyCraftStation) {
          handleCraftAtStation(nearbyCraftStation);
        } else if (nearbyPortal) {
          switchMap(nearbyPortal.targetMapId, nearbyPortal.targetSpawn);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setShowHelpModal(true);
      } else if (e.key === 'm' || e.key === 'M') {
        setShowWorldMapModal(true);
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((z) => Math.min(1.6, parseFloat((z + 0.1).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        setZoomLevel((z) => Math.max(0.9, parseFloat((z - 0.1).toFixed(2))));
      }
    };

    const handleKeyUp = (e) => {
      keysDownRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nearbyNpc, nearbyPortal, nearbyCraftStation, nearbyBaDinhPodium, activeNpc, activeDroppedItem, currentTargetNpcId, solvedIds, targetNpc, collectedItems]);

  // Trả lời câu hỏi lịch sử (Không lộ đáp án đúng khi trả lời sai, và trả lời sai thì không được tiếp tục)
  const handleAnswer = (opt, optIdx) => {
    if (!activeNpc) return;
    setSelectedOptionIdx(optIdx);

    if (opt.isCorrect) {
      SoundEngine.success();
      setPuzzleResult({ success: true, text: opt.feedback });

      threatLevelRef.current = Math.max(0, Math.min(100, threatLevelRef.current + (opt.threatChange || -5)));
      setThreatLevel(Math.round(threatLevelRef.current));

      const isLastQuestion = currentQuestionIdx === activeNpc.questions.length - 1;
      if (isLastQuestion && !solvedIds.includes(activeNpc.id)) {
        const nextSolved = [...solvedIds, activeNpc.id];
        setSolvedIds(nextSolved);

        let nextDirectives = [...collectedDirectives];
        if (activeNpc.directiveKey && !nextDirectives.includes(activeNpc.directiveKey)) {
          nextDirectives.push(activeNpc.directiveKey);
          setCollectedDirectives(nextDirectives);
        }

        // Kiểm tra điều kiện Thắng lợi Tổng Khởi Nghĩa (Gặp Bác Hồ tại Ba Đình)
        if (activeNpc.id === 'NPC_BAC_HO_BADINH') {
          handleTriggerBaDinhCeremony();
          return;
        }

        // KIỂM TRA MỐC RƠI VẬT PHẨM LỊCH SỬ (2-3 NPC hoặc hoàn thành map)
        const milestoneItem = MILESTONE_DROPS[activeNpc.id];
        if (milestoneItem) {
          const dropped = dropRandomItemOnMap(activeNpc.id, currentMapId);
          setActiveDroppedItem(dropped);

          // Hiển thị thông báo tìm kiếm vật phẩm
          setRelicModal({
            title: '★ BẢO VẬT LỊCH SỬ XUẤT HIỆN!',
            name: dropped.name,
            desc: `${activeNpc.name} vừa để lại [${dropped.name}] tại một vị trí bí mật trên chiến khu!\nHãy lần theo mũi tên dẫn đường màu vàng to rõ để tìm và thu thập bảo vật này!`,
            isDropAlert: true
          });
        } else {
          // NPC này không rơi vật phẩm -> Tự động chuyển target sang NPC tiếp theo trong map
          const currentMapNpcs = Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
          const remaining = currentMapNpcs.filter((n) => !nextSolved.includes(n.id));
          if (remaining.length > 0) {
            setCurrentTargetNpcId(remaining[0].id);
          }
        }
      }
    } else {
      SoundEngine.wrong();
      setPuzzleResult({
        success: false,
        text: 'Đáp án bạn chọn chưa chính xác! Bạn không thể tiếp tục cuộc đối thoại này. Hãy đóng lại và thử lại từ đầu!'
      });
      threatLevelRef.current = Math.min(100, threatLevelRef.current + 12);
      const nextT = Math.round(threatLevelRef.current);
      setThreatLevel(nextT);
      if (nextT >= 100 && !capturedModalRef.current) {
        capturedModalRef.current = true;
        setTimeout(() => {
          SoundEngine.alert();
          SoundEngine.wrong();
          setCapturedModal(true);
        }, 120);
      }
    }
  };

  const handleNextQuestion = () => {
    if (!puzzleResult || !puzzleResult.success) return;
    SoundEngine.interact();
    setCurrentQuestionIdx((prev) => prev + 1);
    setPuzzleResult(null);
    setSelectedOptionIdx(null);
  };

  const handleCloseDialogue = () => {
    setActiveNpc(null);
    setCurrentQuestionIdx(0);
    setPuzzleResult(null);
    setSelectedOptionIdx(null);
  };

  // Reset Game
  const handleResetGame = () => {
    SoundEngine.interact();
    resetPlayerForNewRaceSession(syncedStartTimeRef.current);
    setCurrentMapId('MAP_QUANGTRUONG');
    posRef.current = MAP_DEFINITIONS.MAP_QUANGTRUONG.spawn;
    lastDisplayPosRef.current = MAP_DEFINITIONS.MAP_QUANGTRUONG.spawn;
    setPlayerDisplayPos(MAP_DEFINITIONS.MAP_QUANGTRUONG.spawn);
    dirRef.current = 'down';
    threatLevelRef.current = 0;
    setThreatLevel(0);
    setIsPatrolAlerting(false);
    setCollectedDirectives([]);
    setCollectedItems([]);
    setSolvedIds([]);
    setActiveDroppedItem(null);
    setCapturedModal(false);
    capturedModalRef.current = false;
    setCurrentTargetNpcId('NPC_ANH');
    setActiveNpc(null);
    setGameStatus('PLAYING');
  };

  // =========================================================================
  // 5. VÒNG LẶP GAME ENGINE & VẼ CANVAS CHUẨN PIXEL TRUYTIMDANCHU.SITE
  // =========================================================================
  useEffect(() => {
    let animationId;
    let syncUiCounter = 0;

    const gameLoop = (timestamp) => {
      try {
        const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.08);
        lastTimeRef.current = timestamp;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const imgs = imagesRef.current;
        let anyAgentNear = false;

      // 1. CẬP NHẬT VỊ TRÍ NGƯỜI CHƠI (TỐC ĐỘ THONG THẢ 2.6 TILES/S)
      if (gameStatus === 'PLAYING' && backendConnected === 'ONLINE' && !activeNpc && !mapTransitionText && !capturedModalRef.current) {
        let vx = 0;
        let vy = 0;

        const keys = keysDownRef.current;
        if (keys['w'] || keys['arrowup']) vy -= 1;
        if (keys['s'] || keys['arrowdown']) vy += 1;
        if (keys['a'] || keys['arrowleft']) vx -= 1;
        if (keys['d'] || keys['arrowright']) vx += 1;

        if (touchDirRef.current === 'up') vy -= 1;
        if (touchDirRef.current === 'down') vy += 1;
        if (touchDirRef.current === 'left') vx -= 1;
        if (touchDirRef.current === 'right') vx += 1;

        if (vx !== 0 || vy !== 0) {
          if (vx !== 0 && vy !== 0) {
            vx *= 0.7071;
            vy *= 0.7071;
          }

          const WALK_SPEED = 2.6;
          const nx = Math.max(1.2, Math.min(MAP_WIDTH - 2.2, posRef.current.x + vx * WALK_SPEED * dt));
          const ny = Math.max(1.2, Math.min(MAP_HEIGHT - 2.2, posRef.current.y + vy * WALK_SPEED * dt));
          posRef.current = { x: nx, y: ny };

          if (Math.abs(vy) >= Math.abs(vx)) {
            dirRef.current = vy > 0 ? 'down' : 'up';
          } else {
            dirRef.current = vx > 0 ? 'right' : 'left';
          }

          walkTimerRef.current += dt;
          if (walkTimerRef.current >= 0.16) {
            walkTimerRef.current = 0;
            animStepRef.current = (animStepRef.current + 1) % 4;
          }

          stepAudioTimerRef.current += dt;
          if (stepAudioTimerRef.current >= 0.35) {
            stepAudioTimerRef.current = 0;
            SoundEngine.step();
          }
        } else {
          animStepRef.current = 0;
          walkTimerRef.current = 0;
        }

        // 2. CẬP NHẬT MẬT THÁM TUẦN TRA & ĐIỂM BỊ PHÁT HIỆN
        if (patrolsRef.current && patrolsRef.current.length > 0) {
          patrolsRef.current.forEach((p) => {
            if (p.axis === 'y') {
              p.y += p.dir * p.speed * dt;
              if (p.y >= p.maxY) {
                p.y = p.maxY;
                p.dir = -1;
              } else if (p.y <= p.minY) {
                p.y = p.minY;
                p.dir = 1;
              }
            } else {
              p.x += p.dir * p.speed * dt;
              if (p.x >= p.maxX) {
                p.x = p.maxX;
                p.dir = -1;
              } else if (p.x <= p.minX) {
                p.x = p.minX;
                p.dir = 1;
              }
            }

            const dx = p.x - posRef.current.x;
            const dy = p.y - posRef.current.y;
            const distToPlayer = Math.hypot(dx, dy);

            // BÁN KÍNH PHÁT HIỆN: 2.0 ô kích hoạt (Vòng vẽ 2.2 ô)
            if (distToPlayer <= PATROL_DETECT_RADIUS) {
              anyAgentNear = true;
              alertAudioTimerRef.current += dt;
              if (alertAudioTimerRef.current >= 0.32) {
                alertAudioTimerRef.current = 0;
                SoundEngine.alert();
              }

              // TỐC ĐỘ TĂNG ĐIỂM BỊ PHÁT HIỆN: TĂNG RẤT NHANH KHI BƯỚC VÀO VÒNG MẬT THÁM
              // Càng đứng gần mật thám thì điểm vọt lên càng nhanh (35% -> 55% -> 85%/giây)
              const rate = distToPlayer <= 0.9 ? 85 : (distToPlayer <= 1.4 ? 55 : 35);
              threatLevelRef.current = Math.min(100, threatLevelRef.current + rate * dt);
              if (threatLevelRef.current >= 100 && !capturedModalRef.current) {
                capturedModalRef.current = true;
                setTimeout(() => {
                  SoundEngine.alert();
                  SoundEngine.wrong();
                  setCapturedModal(true);
                }, 120);
              }
            }
          });

          // KHI ĐỨNG NGOÀI VÒNG TRÒN: NGỪNG BÁO ĐỘNG & HẠ NHIỆT RẤT CHẬM (3.2%/giây)
          if (!anyAgentNear && threatLevelRef.current > 0) {
            alertAudioTimerRef.current = 0;
            threatLevelRef.current = Math.max(0, threatLevelRef.current - 3.2 * dt);
          }
        }

        // 4. THU THẬP VẬT PHẨM RƠI NGẪU NHIÊN SAU KHI GIẢI CÂU HỎI NPC
        if (activeDroppedItem && activeDroppedItem.mapId === currentMapId) {
          const d = Math.hypot(activeDroppedItem.x - posRef.current.x, activeDroppedItem.y - posRef.current.y);
          if (d <= 1.3) {
            SoundEngine.victory();
            const picked = { ...activeDroppedItem };
            setActiveDroppedItem(null);
            setCollectedItems((prev) => [...prev, picked.id]);
            threatLevelRef.current = Math.max(0, threatLevelRef.current - 20);
            setThreatLevel(Math.round(threatLevelRef.current));

            // Xác định NPC tiếp theo trong chuỗi tuần tự
            const currentMapNpcs = Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
            const remaining = currentMapNpcs.filter((n) => !solvedIds.includes(n.id) && n.id !== picked.npcId);
            if (remaining.length > 0) {
              setCurrentTargetNpcId(remaining[0].id);
            }

            // Kiểm tra xem hiện tại đã có đủ vật phẩm để ghép bảo vật hay chưa
            const recipeCanCraft = HISTORICAL_CRAFTING_RECIPES.find((r) => {
              const hasAll = r.requiredItemIds.every((id) => [...collectedItems, picked.id].includes(id));
              const notDone = !collectedItems.includes(r.resultItemId);
              return hasAll && notDone;
            });

            let extraNotice = '';
            if (recipeCanCraft) {
              extraNotice = `\n\n✦ ĐẶC BIỆT: Bạn đã thu thập đủ nguyên liệu! Hãy đến [${recipeCanCraft.stationName}] để ghép bảo vật [${recipeCanCraft.name}]!`;
            } else if (remaining.length > 0) {
              extraNotice = `\n\nNhiệm vụ tiếp theo đã mở khóa! Hãy tiến đến gặp ${remaining[0].name}!`;
            } else {
              extraNotice = '\n\nChúc mừng! Bạn đã hoàn thành toàn bộ nhiệm vụ tại chiến khu này!';
            }

            setRelicModal({
              title: '✦ BẠN ĐÃ THU THẬP ĐƯỢC BẢO VẬT!',
              name: picked.name,
              desc: picked.desc + extraNotice,
              isCollected: true
            });
          }
        }

        // ĐỒNG BỘ UI THÔNG MINH (CHỈ RE-RENDER KHI CÓ THAY ĐỔI THỰC SỰ - TRÁNH ĐƠ/LAG)
        syncUiCounter++;
        if (syncUiCounter % 6 === 0) {
          const currentIntThreat = Math.round(threatLevelRef.current);
          setThreatLevel((prev) => (prev !== currentIntThreat ? currentIntThreat : prev));
          setIsPatrolAlerting((prev) => (prev !== anyAgentNear ? anyAgentNear : prev));

          const dPos = Math.hypot(
            posRef.current.x - lastDisplayPosRef.current.x,
            posRef.current.y - lastDisplayPosRef.current.y
          );
          // Chỉ cập nhật React state khi di chuyển >= 0.42 ô hoặc khi vừa dừng lại để giảm 80% re-render
          const isMovingNow = vx !== 0 || vy !== 0;
          if (dPos >= 0.42 || (!isMovingNow && dPos >= 0.08)) {
            lastDisplayPosRef.current = { x: posRef.current.x, y: posRef.current.y };
            setPlayerDisplayPos({ x: posRef.current.x, y: posRef.current.y });
          }
        }
      }

      // ===================================================================
      // 4. CANVAS RENDERING SIÊU MƯỢT 60FPS (CACHED DIMENSION + DPR 1.5)
      // ===================================================================
      const cw = canvas.clientWidth || 1024;
      const ch = canvas.clientHeight || 640;
      const rect = { width: cw, height: ch };
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr * zoomLevel, dpr * zoomLevel);
      ctx.imageSmoothingEnabled = false;

      ctx.clearRect(0, 0, rect.width / zoomLevel, rect.height / zoomLevel);

      // Camera bám theo Quang với zoomLevel
      const viewWidth = rect.width / zoomLevel;
      const viewHeight = rect.height / zoomLevel;
      const curX = posRef.current.x;
      const curY = posRef.current.y;
      const camX = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE - viewWidth, curX * TILE_SIZE - viewWidth / 2));
      const camY = Math.max(0, Math.min(MAP_HEIGHT * TILE_SIZE - viewHeight, curY * TILE_SIZE - viewHeight / 2));

      ctx.save();
      ctx.translate(Math.round(-camX), Math.round(-camY));

      // A. Vẽ Map Tiles
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const tile = mapData[y][x];
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          let tileImg = imgs.tileGrass;
          if (tile === TILES.GRASS_PLAZA) tileImg = imgs.tileGrassPlaza || imgs.tileGrass;
          else if (tile === TILES.PATH) tileImg = imgs.tilePath;
          else if (tile === TILES.MUSEUM_FLOOR) tileImg = imgs.tileCity;
          else if (tile === TILES.FOREST) tileImg = imgs.tileForest;
          else if (tile === TILES.WATER) tileImg = imgs.tileWater;
          else if (tile === TILES.ROCKY) tileImg = imgs.tileRocky;

          if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
            ctx.drawImage(tileImg, px, py, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = tile === TILES.PATH ? '#dec9a3' : (tile === TILES.GRASS_PLAZA ? '#3c6b44' : '#4e825b');
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // B. Vẽ Khung Viền Sandstone Viền Quanh Sân Cỏ Quảng Trường (Đặc trưng của ảnh mẫu)
      if (currentMap.courtyardBorder) {
        const cb = currentMap.courtyardBorder;
        const bx = cb.x * TILE_SIZE;
        const by = cb.y * TILE_SIZE;
        const bw = cb.w * TILE_SIZE;
        const bh = cb.h * TILE_SIZE;

        // Sandstone Curb Top face
        ctx.strokeStyle = '#d4b079';
        ctx.lineWidth = 10;
        ctx.strokeRect(bx, by, bw, bh);

        // Highlight inner edge
        ctx.strokeStyle = '#f2d6a5';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

        // Shadow outer edge
        ctx.strokeStyle = '#9c7743';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 5, by - 5, bw + 10, bh + 10);
      }

      // C. Vẽ Chữ In Nổi Trên Mặt Đất (Ground Labels - Điểm nhấn truytimdanchu.site)
      if (currentMap.groundLabel1) {
        ctx.save();
        ctx.font = '900 20px monospace, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 245, 0.42)';
        ctx.textAlign = 'center';
        // In ở giữa sân cỏ quảng trường
        ctx.fillText(currentMap.groundLabel1, 10 * TILE_SIZE, 6 * TILE_SIZE + 24);
        ctx.restore();
      }

      if (currentMap.groundLabel2) {
        ctx.save();
        ctx.font = '900 18px monospace, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 245, 0.45)';
        ctx.textAlign = 'center';
        // In trên mặt đường cát nối dài
        ctx.fillText(currentMap.groundLabel2, 22 * TILE_SIZE, 11 * TILE_SIZE + 10);
        ctx.restore();
      }

      // D. Các đốm hoa / bụi sáng lấp lánh trên cỏ
      const sparkleSeed = Math.floor(timestamp / 500);
      const sparklePoints = [
        { x: 19 * TILE_SIZE + 10, y: 7 * TILE_SIZE + 8 },
        { x: 21 * TILE_SIZE + 24, y: 8 * TILE_SIZE + 16 },
        { x: 18 * TILE_SIZE + 32, y: 16 * TILE_SIZE + 20 },
        { x: 24 * TILE_SIZE + 14, y: 17 * TILE_SIZE + 12 }
      ];
      sparklePoints.forEach((sp, idx) => {
        const alpha = 0.3 + 0.4 * Math.sin(timestamp * 0.004 + idx);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(sp.x, sp.y, 3, 3);
      });

      // E. Vẽ Cổng Dịch Chuyển (Portals)
      currentMap.portals.forEach((portal) => {
        const pox = portal.x * TILE_SIZE;
        const poy = portal.y * TILE_SIZE;

        const targetMapDef = MAP_DEFINITIONS[portal.targetMapId];
        const curMapDef = MAP_DEFINITIONS[currentMapId];
        const isLeadingForward = targetMapDef && curMapDef && targetMapDef.chapterNum > curMapDef.chapterNum;
        const curMapNpcs = Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
        const allQuestsDone = curMapNpcs.every((n) => solvedIds.includes(n.id)) && activeDroppedItem === null;
        const isLocked = isLeadingForward && !allQuestsDone;

        const portalPulse = 0.8 + 0.2 * Math.sin(timestamp * 0.005);
        if (isLocked) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * portalPulse})`;
          ctx.beginPath();
          ctx.ellipse(pox + 24, poy + 24, 30, 16, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#fca5a5';
          ctx.textAlign = 'center';
          ctx.fillText(`🔒 ${portal.label.replace('✦ ', '')} (CỔNG KHÓA)`, pox + 24, poy - 8);
        } else {
          ctx.save();
          if (isLeadingForward && allQuestsDone) {
            ctx.shadowColor = 'rgba(34, 197, 94, 0.9)';
            ctx.shadowBlur = 16 * portalPulse;
          }
          ctx.fillStyle = isLeadingForward && allQuestsDone
            ? `rgba(34, 197, 94, ${0.45 * portalPulse})`
            : `rgba(234, 179, 8, ${0.3 * portalPulse})`;
          ctx.beginPath();
          ctx.ellipse(pox + 24, poy + 24, 32, 18, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isLeadingForward ? '#22c55e' : '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = isLeadingForward ? '#86efac' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(isLeadingForward && allQuestsDone ? '✦ CỔNG ĐÃ MỞ (BƯỚC VÀO) →' : portal.label, pox + 24, poy - 10);
          ctx.restore();
        }
      });

      // F. Vẽ Đạo Cụ Địa Hình Đặc Trưng của Map
      if (currentMap.props) {
        currentMap.props.forEach((p) => {
          const pImg = imgs[p.key];
          if (pImg && pImg.complete) {
            ctx.drawImage(pImg, p.x * TILE_SIZE, p.y * TILE_SIZE, p.w, p.h);
          }
        });
      }

      // F2. Vẽ Bàn Ghép Bảo Vật Lịch Sử (Crafting Station) của map này (nếu có)
      if (currentMapRecipe) {
        const sc = currentMapRecipe.stationCoord;
        const stx = sc.x * TILE_SIZE + 24;
        const sty = sc.y * TILE_SIZE + 24;
        const isReady = hasCraftMaterials(currentMapRecipe) && !isCraftCompleted(currentMapRecipe);
        const isDone = isCraftCompleted(currentMapRecipe);

        ctx.save();
        const craftPulse = 0.75 + 0.25 * Math.sin(timestamp * 0.007);
        if (isReady) {
          ctx.shadowColor = 'rgba(250, 204, 21, 0.95)';
          ctx.shadowBlur = 18 * craftPulse;
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.9 * craftPulse})`;
          ctx.lineWidth = 2.5;
        } else if (isDone) {
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.lineWidth = 1.8;
        } else {
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
          ctx.lineWidth = 1.4;
        }

        ctx.beginPath();
        ctx.ellipse(stx, sty + 14, 28, 14, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Huy hiệu bay lơ lửng phía trên trạm
        const craftBounce = Math.sin(timestamp * 0.008) * 3;
        const badgeY = sty - 38 + craftBounce;
        let badgeText = isReady ? `✦ GHÉP BẢO VẬT [E]` : (isDone ? `✓ Đã Hoàn Thành` : `✦ Bàn Ghép Bảo Vật`);

        ctx.font = 'bold 10.5px sans-serif';
        const bWidth = Math.round(ctx.measureText(badgeText).width + 16);
        ctx.fillStyle = isReady ? '#f59e0b' : (isDone ? '#166534' : '#292524');
        ctx.beginPath();
        ctx.roundRect(stx - bWidth / 2, badgeY, bWidth, 18, 4);
        ctx.fill();

        ctx.strokeStyle = isReady ? '#fef08a' : (isDone ? '#4ade80' : '#78716c');
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = isReady ? '#1c1917' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, stx, badgeY + 9);
        ctx.restore();
      }

      // F3. Vẽ Lễ Đài Tuyên Ngôn Độc Lập tại Ba Đình
      if (currentMapId === 'MAP_BADINH') {
        const pdx = 15 * TILE_SIZE;
        const pdy = 5 * TILE_SIZE;
        const pdPulse = 0.8 + 0.2 * Math.sin(timestamp * 0.006);

        ctx.save();
        ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
        ctx.shadowBlur = 16 * pdPulse;

        ctx.font = '900 11px sans-serif';
        const pdText = '⭐ ĐẠI LỄ ĐÀI TUYÊN NGÔN ĐỘC LẬP 2/9/1945 [E]';
        const pdW = Math.round(ctx.measureText(pdText).width + 20);

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(pdx - pdW / 2, pdy - 28, pdW, 20, 5);
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pdText, pdx, pdy - 18);
        ctx.restore();
      }

      // G. Vẽ Kỷ Vật Lịch Sử Rơi Ngẫu Nhiên (activeDroppedItem) & Đạo Cụ Khác
      if (activeDroppedItem && activeDroppedItem.mapId === currentMapId) {
        const itemX = activeDroppedItem.x * TILE_SIZE + 24;
        const itemY = activeDroppedItem.y * TILE_SIZE + 24;
        const itemBounce = Math.sin(timestamp * 0.008) * 6;

        ctx.save();
        // Hào quang vàng rực rỡ lan tỏa
        const auraPulse = 0.75 + 0.25 * Math.sin(timestamp * 0.006);
        ctx.shadowColor = 'rgba(250, 204, 21, 0.95)';
        ctx.shadowBlur = 18 * auraPulse;

        ctx.fillStyle = `rgba(245, 158, 11, ${0.35 * auraPulse})`;
        ctx.beginPath();
        ctx.arc(itemX, itemY + 8, 24, 0, Math.PI * 2);
        ctx.fill();

        // Biểu tượng huy chương / ngôi sao vàng 3D
        const iconY = itemY - 6 + itemBounce;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(itemX, iconY, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', itemX, iconY);

        // Hạt sáng lấp lánh xoay quanh
        for (let i = 0; i < 4; i++) {
          const spAngle = timestamp * 0.004 + (i * Math.PI) / 2;
          const spX = itemX + Math.cos(spAngle) * 22;
          const spY = iconY + Math.sin(spAngle) * 17;
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(spX - 1.5, spY - 1.5, 3, 3);
        }
        ctx.restore();

        // Thẻ bài kỷ vật nổi bật
        const itemTag = `✦ ${activeDroppedItem.name}`;
        ctx.font = 'bold 11px sans-serif';
        const tagWidth = Math.round(ctx.measureText(itemTag).width + 18);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(itemX - tagWidth / 2, iconY - 27, tagWidth, 18, 4);
        ctx.fill();

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#1c1917';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(itemTag, itemX, iconY - 18);
      }

      // H. Vẽ Mật Thám Pháp Tuần Tra (Cảnh báo nguy hiểm & Vòng tròn phát hiện)
      if (patrolsRef.current) {
        patrolsRef.current.forEach((patrol) => {
          const pax = Math.round(patrol.x * TILE_SIZE);
          const pay = Math.round(patrol.y * TILE_SIZE);
          const centerX = pax + 24;
          const centerY = pay + 36;

          const distToPlayer = Math.hypot(patrol.x - curX, patrol.y - curY);
          const isDetecting = distToPlayer <= PATROL_DETECT_RADIUS;

          // VÒNG TRÒN CẢNH BÁO ĐỎ CHUẨN XÁC 100% (ĐÃ THU NHỎ GỌN THEO YÊU CẦU)
          const pulse = 0.75 + 0.25 * Math.sin(timestamp * 0.009);
          const visualRadius = PATROL_VISUAL_RADIUS * TILE_SIZE; // 2.2 * 48 = 105.6px
          const innerCoreRadius = 1.0 * TILE_SIZE; // 48px

          ctx.save();
          if (isDetecting) {
            ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
            ctx.shadowBlur = 12 * pulse;
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 * pulse})`;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.22 * pulse})`;
          } else {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
          }

          // Vẽ Vòng Tròn Ngoại Vi (Visual Detection Circle)
          ctx.beginPath();
          ctx.arc(centerX, centerY, visualRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Vòng radar đồng tâm bên trong biểu thị vùng nguy cấp tử địa (< 1.0 ô)
          ctx.strokeStyle = isDetecting ? `rgba(255, 60, 60, ${0.7 * pulse})` : 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerCoreRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // Sprite Mật Thám Pháp (Áo trench coat xanh đen + Mũ phớt + Kính đen)
          const patImg = imgs.patrolAgent;
          if (patImg && patImg.complete) {
            ctx.drawImage(patImg, pax + 24 - CHAR_WIDTH / 2, pay + 44 - CHAR_HEIGHT, CHAR_WIDTH, CHAR_HEIGHT);
          }

          // Dấu chấm than cảnh báo [!] CHỈ HIỆN KHI NGƯỜI CHƠI THỰC SỰ ĐỨNG TRONG VÒNG TRÒN
          if (isDetecting) {
            const alertBounce = Math.sin(timestamp * 0.015) * 4;
            const alX = pax + 24;
            const alY = pay - 54 + alertBounce;

            ctx.save();
            ctx.shadowColor = 'rgba(239, 68, 68, 1)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(alX, alY, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = '900 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', alX, alY + 0.5);
            ctx.restore();
          }

          // Thẻ tên mật thám
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = isDetecting ? '#ef4444' : '#f87171';
          ctx.textAlign = 'center';
          ctx.fillText(isDetecting ? '⚠️ MẬT THÁM (PHÁT HIỆN!)' : 'MẬT THÁM PHÁP', pax + 24, pay - 36);
        });
      }

      // I. Vẽ Các Nhân Vật trong Map (Anh, Bình, Linh, Ngọc, Dũng, Khánh, Đức, Hùng, Bác Hồ, ...)
      mapNpcs.forEach((npc) => {
        const nx = Math.round(npc.x * TILE_SIZE);
        const ny = Math.round(npc.y * TILE_SIZE);
        const activeTargetId = nextUnsolvedNpcInMap ? nextUnsolvedNpcInMap.id : currentTargetNpcId;
        const isTarget = npc.id === activeTargetId;
        const isSolved = solvedIds.includes(npc.id);
        const isCurrentActiveTarget = isTarget && !isSolved && activeDroppedItem === null && !isCurMapAllNpcsSolved;

        const npcImg = imgs[npc.spriteKey] || imgs.npcBacHo;
        if (npcImg && npcImg.complete && npcImg.naturalWidth > 0) {
          ctx.drawImage(npcImg, nx + 24 - CHAR_WIDTH / 2, ny + 44 - CHAR_HEIGHT, CHAR_WIDTH, CHAR_HEIGHT);
        } else {
          ctx.fillStyle = '#655';
          ctx.fillRect(nx + 4, ny - 10, 40, 54);
        }

        // BẢNG TÊN CHIBI:
        // - Mục tiêu chính (Target khi chưa có kỷ vật rơi): Viền bo màu vàng hổ phách, chữ đen đậm: [ ? Anh ]
        // - Đã hoàn thành: Nền xanh lá [ ✓ Anh ]
        // - NPC thông thường: Nền than xám đen mờ [ Bình ], [ Linh ]...
        const tagText = isCurrentActiveTarget ? `? ${npc.name}` : (isSolved ? `✓ ${npc.name}` : npc.name);
        ctx.font = 'bold 11.5px sans-serif';
        const textMetrics = ctx.measureText(tagText);
        const tagWidth = Math.round(textMetrics.width + 18);
        const tagH = 18;
        const tagX = Math.round(nx + 24 - tagWidth / 2);
        const tagY = ny - 36;

        if (isCurrentActiveTarget) {
          // Thẻ bài vàng cam nổi bật của Mục tiêu kế tiếp [ ? Anh ]
          ctx.fillStyle = '#e5a855';
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagWidth, tagH, 3.5);
          ctx.fill();

          ctx.strokeStyle = '#c08332';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#1c1917';
          ctx.textAlign = 'center';
          ctx.fillText(tagText, nx + 24, tagY + 13);
        } else {
          // Thẻ bài tối giản thanh lịch như các bạn khác
          ctx.fillStyle = isSolved ? 'rgba(16, 40, 28, 0.94)' : 'rgba(18, 26, 28, 0.94)';
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagWidth, tagH, 3.5);
          ctx.fill();

          ctx.strokeStyle = isSolved ? '#22c55e' : 'rgba(56, 75, 78, 0.7)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isSolved ? '#86efac' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(tagText, nx + 24, tagY + 13);
        }

        // DẤU [ ? ] TRÊN ĐẦU NPC CÓ NHIỆM VỤ MÀ NHÂN VẬT CẦN GẶP:
        // CHỈ HIỂN THỊ DUY NHẤT TRÊN ĐẦU NPC MỤC TIÊU HIỆN TẠI VÀ CHƯA CÓ KỶ VẬT RƠI!
        if (isCurrentActiveTarget && !isSolved) {
          const bounce = Math.sin(timestamp * 0.007) * 4.5;
          const qX = nx + 24;
          const qY = ny - 56 + bounce;

          ctx.save();
          ctx.shadowColor = 'rgba(250, 204, 21, 0.95)';
          ctx.shadowBlur = 14;

          const qRadius = 13;
          ctx.beginPath();
          ctx.arc(qX, qY, qRadius, 0, Math.PI * 2);

          const grad = ctx.createLinearGradient(qX, qY - qRadius, qX, qY + qRadius);
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(1, '#f59e0b');
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Mũi nhọn tam giác trỏ xuống đầu nhân vật
          ctx.beginPath();
          ctx.moveTo(qX - 4, qY + qRadius - 1);
          ctx.lineTo(qX, qY + qRadius + 5);
          ctx.lineTo(qX + 4, qY + qRadius - 1);
          ctx.closePath();
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Ký tự dấu ? đậm nét ở chính giữa
          ctx.font = '900 15px sans-serif';
          ctx.fillStyle = '#1c1917';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', qX, qY + 0.5);

          ctx.restore();
        }
      });

      // J. Vẽ Người Chơi (Quang HD) + Mũi Tên Chỉ Đường Siêu Lớn & Rõ Ràng
      const px = Math.round(curX * TILE_SIZE);
      const py = Math.round(curY * TILE_SIZE);

      let angle = 0;
      let distText = '';

      if (activeDroppedItem && activeDroppedItem.mapId === currentMapId) {
        // 1. ƯU TIÊN SỐ 1: HƯỚNG TỚI KỶ VẬT ĐANG RƠI TRÊN BẢN ĐỒ!
        angle = Math.atan2(activeDroppedItem.y * TILE_SIZE - py, activeDroppedItem.x * TILE_SIZE - px);
        const itemDist = Math.max(1, Math.round(Math.hypot(activeDroppedItem.x - curX, activeDroppedItem.y - curY) * 2));
        distText = `✦ Tìm: ${activeDroppedItem.name} · ${itemDist}m`;
      } else if (readyCraftRecipe && readyCraftRecipe.targetMapId === currentMapId) {
        // 2. ƯU TIÊN SỐ 2: ĐÃ ĐỦ NGUYÊN LIỆU ĐANG Ở CÙNG MAP -> HƯỚNG VỀ BÀN GHÉP BẢO VẬT!
        const sc = readyCraftRecipe.stationCoord;
        angle = Math.atan2(sc.y * TILE_SIZE - py, sc.x * TILE_SIZE - px);
        const craftDist = Math.max(1, Math.round(Math.hypot(sc.x - curX, sc.y - curY) * 2));
        distText = `✦ Ghép: ${readyCraftRecipe.name.substring(0, 18)}... · ${craftDist}m`;
      } else if (readyCraftRecipe && readyCraftRecipe.targetMapId !== currentMapId) {
        // 3. ĐÃ ĐỦ NGUYÊN LIỆU NHƯNG TRẠM GHÉP Ở MAP TRƯỚC -> HƯỚNG TỚI CỔNG QUAY VỀ
        const backPortal = currentMap.portals.find((p) => {
          const targetDef = MAP_DEFINITIONS[p.targetMapId];
          const curDef = MAP_DEFINITIONS[currentMapId];
          return targetDef && curDef && targetDef.chapterNum < curDef.chapterNum;
        }) || currentMap.portals[0];

        if (backPortal) {
          angle = Math.atan2(backPortal.y * TILE_SIZE - py, backPortal.x * TILE_SIZE - px);
          const pDist = Math.max(1, Math.round(Math.hypot(backPortal.x - curX, backPortal.y - curY) * 2));
          distText = `Quay về ${readyCraftRecipe.stationName.substring(0, 16)}... · ${pDist}m`;
        }
      } else if (currentMapId === 'MAP_BADINH' && !solvedIds.includes('NPC_BAC_HO_BADINH')) {
        // 4. TẠI BA ĐÌNH: HƯỚNG TỚI LỄ ĐÀI & BÁC HỒ
        angle = Math.atan2(6 * TILE_SIZE - py, 15 * TILE_SIZE - px);
        const badinhDist = Math.max(1, Math.round(Math.hypot(15 - curX, 6 - curY) * 2));
        distText = `Lễ Đài Ba Đình · ${badinhDist}m`;
      } else if (!isCurMapAllNpcsSolved && nextUnsolvedNpcInMap) {
        // 5. HƯỚNG TỚI NPC MỤC TIÊU TIẾP THEO TRONG MAP HIỆN TẠI
        angle = Math.atan2(nextUnsolvedNpcInMap.y * TILE_SIZE - py, nextUnsolvedNpcInMap.x * TILE_SIZE - px);
        const targetDist = Math.max(1, Math.round(Math.hypot(nextUnsolvedNpcInMap.x - curX, nextUnsolvedNpcInMap.y - curY)));
        distText = `Gặp ${nextUnsolvedNpcInMap.name} · ${targetDist}m`;
      } else if (forwardNextPortal) {
        // 6. ĐÃ HOÀN THÀNH TOÀN BỘ NHIỆM VỤ MAP HIỆN TẠI -> HƯỚNG THẲNG TỚI CỔNG MAP MỚI!
        angle = Math.atan2(forwardNextPortal.y * TILE_SIZE - py, forwardNextPortal.x * TILE_SIZE - px);
        const pDist = Math.max(1, Math.round(Math.hypot(forwardNextPortal.x - curX, forwardNextPortal.y - curY) * 2));
        distText = `✦ Cổng ${forwardNextPortal.label.replace('✦ ', '')} · ${pDist}m`;
      } else {
        // 7. DỰ PHÒNG CỔNG MẶC ĐỊNH
        const portal = currentMap.portals[0];
        if (portal) {
          angle = Math.atan2(portal.y * TILE_SIZE - py, portal.x * TILE_SIZE - px);
          const pDist = Math.max(1, Math.round(Math.hypot(portal.x - curX, portal.y - curY) * 2));
          distText = `Cổng ${portal.label.replace('✦ ', '')} · ${pDist}m`;
        }
      }

      // 1. MŨI TÊN CHỈ ĐƯỜNG VÀNG KIM SIÊU TO & ĐẬM NÉT (XOAY THEO HƯỚNG MỤC TIÊU)
      const arrowPulse = 0.85 + 0.15 * Math.sin(timestamp * 0.008);
      ctx.save();
      // Đặt gốc toạ độ xoay tại điểm chân người chơi
      ctx.translate(px + 24, py + 48);
      ctx.rotate(angle);

      // Hào quang vàng rực rỡ chỉ đường
      ctx.shadowColor = 'rgba(250, 204, 21, 1)';
      ctx.shadowBlur = 14 * arrowPulse;

      // Thân Mũi Tên Chỉ Đường 3D TO RÕ (Dài 36px, rộng 26px, chevron dày dặn)
      ctx.beginPath();
      ctx.moveTo(36, 0);       // Đỉnh nhọn chỉ thẳng mục tiêu
      ctx.lineTo(8, -13);      // Cánh trên
      ctx.lineTo(15, 0);       // Góc thụt đuôi
      ctx.lineTo(8, 13);       // Cánh dưới
      ctx.closePath();

      // Nửa trên vàng tươi sáng #fef08a
      ctx.fillStyle = '#fef08a';
      ctx.fill();

      // Nửa dưới vàng hổ phách #d97706 tạo khối 3D nổi bật
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(15, 0);
      ctx.lineTo(8, 13);
      ctx.closePath();
      ctx.fillStyle = '#d97706';
      ctx.fill();

      // Viền sắc sảo màu nâu sẫm đậm nét
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Vạch chevron nhấp nháy dẫn hướng phía trước mũi tên (ở khoảng cách 44px - 52px)
      const pulseLead = 44 + 5 * Math.sin(timestamp * 0.009);
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.45 + 0.5 * Math.sin(timestamp * 0.009)})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pulseLead, -6);
      ctx.lineTo(pulseLead + 6, 0);
      ctx.lineTo(pulseLead, 6);
      ctx.stroke();

      ctx.restore(); // Kết thúc vẽ mũi tên

      // 2. VẼ SPRITE QUANG (TO RÕ 58x76, ĐỨNG VỮNG TRÊN NỀN ĐẤT)
      const curDir = dirRef.current;
      const curStep = animStepRef.current;
      let pKey = `player_${curDir}`;
      if (curStep === 1) pKey += '_walk1';
      else if (curStep === 3) pKey += '_walk2';

      const pImg = imgs[pKey] || imgs.player_down;
      if (pImg && pImg.complete && pImg.naturalWidth > 0) {
        ctx.drawImage(pImg, px + 24 - CHAR_WIDTH / 2, py + 44 - CHAR_HEIGHT, CHAR_WIDTH, CHAR_HEIGHT);
      }

      // 3. THẺ TÊN [ Hò Văn Tèn ] TRÊN ĐẦU
      const currentDisplayName = (playerName || 'Hò Văn Tèn').trim();
      ctx.font = 'bold 11.5px sans-serif';
      const nameWidth = Math.max(52, Math.round(ctx.measureText(currentDisplayName).width + 16));

      ctx.fillStyle = '#183850';
      ctx.beginPath();
      ctx.roundRect(px + 24 - nameWidth / 2, py - 36, nameWidth, 18, 4);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(currentDisplayName, px + 24, py - 23);

      // 4. HUY HIỆU MỤC TIÊU & KHOẢNG CÁCH DƯỚI CHÂN TO RÕ
      ctx.font = 'bold 12px sans-serif';
      const distW = Math.round(ctx.measureText(distText).width + 24);
      const badgeY = py + 68;

      ctx.fillStyle = activeDroppedItem ? '#2a1a06' : '#14211e';
      ctx.beginPath();
      ctx.roundRect(px + 24 - distW / 2, badgeY, distW, 22, 6);
      ctx.fill();

      ctx.strokeStyle = activeDroppedItem ? '#f59e0b' : '#eab308';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = activeDroppedItem ? '#fef08a' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(distText, px + 24, badgeY + 15);

      ctx.restore();
      ctx.restore();
      } catch (err) {
        console.error('Lỗi gameLoop:', err);
      } finally {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    lastTimeRef.current = performance.now();
    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [gameStatus, backendConnected, activeNpc, currentMapId, currentTargetNpcId, solvedIds, targetNpc, assetsLoaded, mapTransitionText, collectedItems, zoomLevel, activeDroppedItem, readyCraftRecipe, currentMapRecipe, isCurMapAllNpcsSolved, nextUnsolvedNpcInMap, forwardNextPortal, playerName]);

  // Đếm tiến trình hoàn thành của chương hiện tại
  const currentChapterNpcs = useMemo(() => {
    return Object.values(ALL_HISTORICAL_NPCS).filter((n) => n.mapId === currentMapId);
  }, [currentMapId]);

  const solvedInCurrentChapter = useMemo(() => {
    return currentChapterNpcs.filter((n) => solvedIds.includes(n.id)).length;
  }, [currentChapterNpcs, solvedIds]);

  return (
    <div className="min-h-screen bg-[#111c18] text-stone-100 flex flex-col font-sans selection:bg-amber-600 selection:text-black select-none">
      {/* ===================================================================
          1. THANH ĐIỀU HƯỚNG CÁCH MẠNG - CON ĐƯỜNG ĐỘC LẬP (1930 – 1945)
      =================================================================== */}
      <header className="bg-gradient-to-r from-[#2b0808] via-[#3b0d0d] to-[#220a0a] border-b-2 border-amber-500/60 px-3 sm:px-5 py-2.5 flex items-center justify-between shadow-2xl z-30 flex-wrap gap-2.5">
        {/* CỤM TRÁI: THƯƠNG HIỆU "CON ĐƯỜNG ĐỘC LẬP" & HỒ SƠ CHIẾN SĨ */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-700 via-red-600 to-amber-600 border border-amber-300/80 flex items-center justify-center shadow-md shadow-red-950/60 flex-shrink-0">
              <span className="text-yellow-300 text-sm font-black drop-shadow">★</span>
            </div>
            <div className="leading-tight">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs sm:text-sm font-black tracking-wider text-amber-300 uppercase">
                  CON ĐƯỜNG ĐỘC LẬP
                </span>
                <span className="text-[10px] font-mono font-extrabold bg-red-900/80 text-amber-200 border border-amber-400/40 px-1.5 py-0.5 rounded-md hidden sm:inline-block">
                  1930 – 1945
                </span>
              </div>
              <p className="text-[10px] text-emerald-300/80 font-medium hidden 2xl:block">
                Hành trình Lịch sử Cách mạng giải phóng dân tộc
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-[#28463a] hidden sm:block" />

          {/* Ô nhập đổi tên nhân vật (Mặc định: Hò Văn Tèn) */}
          <div
            className="flex items-center space-x-1.5 bg-[#0e1c16] border border-amber-500/40 hover:border-amber-400 focus-within:border-amber-400 px-2.5 py-1 rounded-xl shadow-inner transition group"
            title="Đổi tên chiến sĩ của bạn (mặc định: Hò Văn Tèn)"
          >
            <User className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            <span className="text-[11px] font-bold text-stone-400 hidden md:inline">Chiến sĩ:</span>
            <input
              type="text"
              value={playerName}
              maxLength={22}
              onChange={(e) => {
                const val = e.target.value;
                setPlayerName(val);
                try {
                  localStorage.setItem('cddl_player_name', val);
                } catch {}
              }}
              placeholder="Hò Văn Tèn"
              className="bg-transparent border-none text-xs font-black text-amber-200 focus:outline-none rounded px-1 w-24 sm:w-28 py-0 placeholder-amber-200/50"
            />
            <Edit3 className="w-3 h-3 text-stone-500 group-hover:text-amber-300 transition-colors flex-shrink-0" />
          </div>
        </div>

        {/* CỤM GIỮA: TRẠNG THÁI BACKEND & TRUNG TÂM ĐUA TOP 60 NGƯỜI */}
        <div className="flex items-center bg-[#160707]/95 border border-amber-500/40 rounded-xl px-3 py-1 space-x-2 sm:space-x-3 shadow-inner">
          {/* Trạng thái kết nối Backend trên máy hiện tại */}
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${
              backendConnected === 'ONLINE'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : backendConnected === 'CHECKING'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse'
                : 'bg-red-950/90 text-red-300 border-red-500 animate-bounce'
            }`}
            title={`Backend Server: ${backendUrl || 'Chưa cấu hình'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected === 'ONLINE'
                  ? 'bg-emerald-400 animate-ping'
                  : backendConnected === 'CHECKING'
                  ? 'bg-amber-400'
                  : 'bg-red-500'
              }`}
            />
            <span>
              {backendConnected === 'ONLINE'
                ? 'BE: ONLINE'
                : backendConnected === 'CHECKING'
                ? 'BE: ĐANG KẾT NỐI...'
                : 'BE: ĐÃ TẮT'}
            </span>
          </div>

          <span className="text-amber-500/40">•</span>

          {/* NẾU CHƯA VÀO PHÒNG: HIỆN Ô NHẬP CODE PHÒNG ĐUA */}
          {!roomCode ? (
            <form onSubmit={handlePlayerJoinByCode} className="flex items-center space-x-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 hidden sm:inline" />
              <input
                type="text"
                value={joinCodeInput}
                maxLength={10}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã phòng..."
                className="bg-[#0e1c16] border border-amber-500/50 focus:border-amber-400 text-xs font-mono font-bold text-amber-200 placeholder-stone-400 px-2.5 py-1 rounded-lg w-32 sm:w-36 focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-lg text-[11px] uppercase shadow transition active:scale-95"
              >
                Vào Phòng
              </button>
            </form>
          ) : (
            /* NẾU ĐÃ NHẬP CODE HOẶC QUÉT QR: HIỆN ĐANG Ở TRONG PHÒNG + MÃ CODE */
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
                <Trophy className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                <span className="text-[11px] text-emerald-300 font-bold hidden sm:inline">Trong phòng:</span>
                <span className="font-mono text-xs font-black text-amber-300">
                  {roomCode}
                </span>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="text-[10px] text-stone-400 hover:text-red-400 ml-1 font-bold"
                  title="Rời phòng / Đổi mã phòng khác"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs flex items-center space-x-1" title="Thứ hạng hiện tại trong phòng">
                <span className="text-stone-400 hidden md:inline">Hạng:</span>
                <b className="text-amber-400 font-black">#{myRankInRoom}</b>
                <span className="text-stone-400 text-[11px]">/{totalPlayersInRoom}</span>
              </div>

              <div className="hidden sm:flex items-center space-x-1 text-emerald-400 font-mono text-xs font-bold">
                <Timer className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formatRaceTime(raceElapsedSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold rounded-lg text-[11px] transition"
                title="Xem Bảng Xếp Hạng Phòng Đua"
              >
                <span>BXH Phòng</span>
              </button>
            </div>
          )}

          {/* NÚT QUẢN TRỊ VIÊN (HOST) */}
          {isHostMachine ? (
            <button
              type="button"
              onClick={() => {
                setRoomCode('');
                setShowHostModal(true);
              }}
              className="px-2.5 py-1 bg-neutral-200 hover:bg-white text-neutral-900 font-semibold rounded-md text-[11px] transition"
              title="Mở trang Quản trị phòng thi"
            >
              Quản trị
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdminLoginError('');
                setShowAdminLoginModal(true);
              }}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-200 font-medium rounded-md text-[11px] transition"
              title="Đăng nhập Quản trị viên"
            >
              Quản trị
            </button>
          )}
        </div>

        {/* CỤM PHẢI: CÔNG CỤ CHIẾN THUẬT & ĐIỀU KHIỂN */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
          {/* Cảnh báo Mật thám Pháp */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-xs transition-colors ${
              isPatrolAlerting
                ? 'bg-red-950/90 border-red-500 animate-pulse text-red-200 ring-2 ring-red-500/50'
                : threatLevel > 50
                ? 'bg-[#241712] border-amber-600/70 text-amber-300'
                : 'bg-[#0e1c16] border-[#264237] text-stone-300'
            }`}
            title="Mức độ cảnh giác của Mật thám tuần tra"
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                isPatrolAlerting
                  ? 'text-red-400 animate-bounce'
                  : threatLevel >= 35
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
            <span className="font-medium hidden xl:inline">
              {isPatrolAlerting ? '⚠️ BỊ LỘ:' : 'Mật thám:'}
            </span>
            <b
              className={`font-mono ${
                isPatrolAlerting
                  ? 'text-red-400 font-black'
                  : threatLevel >= 70
                  ? 'text-red-400 font-bold'
                  : threatLevel >= 35
                  ? 'text-amber-300 font-bold'
                  : 'text-emerald-400 font-bold'
              }`}
            >
              {Math.round(threatLevel)}%
            </b>
          </div>

          {/* Sơ đồ 6 Chiến khu */}
          <button
            onClick={() => setShowWorldMapModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 rounded-xl text-xs font-bold text-amber-300 transition shadow"
            title="Mở Sơ đồ 6 Chiến khu Cách mạng [M]"
          >
            <MapIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>6 Chiến khu [M]</span>
          </button>

          {/* Sổ tay 8 Văn kiện Lịch sử */}
          <button
            onClick={() => setShowDirectivesModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#13261e] hover:bg-[#1b352a] border border-[#28483b] rounded-xl text-xs font-semibold text-amber-200 transition"
            title="Sổ tay 8 Văn kiện Lịch sử Cách mạng (1930 – 1945)"
          >
            <Scroll className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Văn kiện ({collectedDirectives.length}/8)</span>
            <span className="md:hidden">{collectedDirectives.length}/8</span>
          </button>

          {/* Điều chỉnh độ phóng (Zoom) */}
          <div className="hidden sm:flex items-center bg-[#0e1c16] border border-[#264237] rounded-xl px-1.5 py-0.5 space-x-1" title="Thu phóng bản đồ [+ / -]">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.9, parseFloat((z - 0.1).toFixed(2))))}
              className="p-1 text-stone-300 hover:text-amber-400 transition"
              title="Thu nhỏ [-]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold text-amber-300 min-w-8 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, parseFloat((z + 0.1).toFixed(2))))}
              className="p-1 text-stone-300 hover:text-amber-400 transition"
              title="Phóng to [+]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Âm thanh */}
          <button
            onClick={() => {
              SoundEngine.interact();
              setSoundOn(!soundOn);
              SoundEngine.enabled = !soundOn;
            }}
            className="p-1.5 bg-[#0e1c16] hover:bg-[#193127] border border-[#264237] rounded-xl text-stone-300 transition"
            title="Bật / Tắt âm thanh"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>

          {/* Mở rộng khung hình */}
          <button
            onClick={() => setIsExpandedScreen(!isExpandedScreen)}
            className="p-1.5 bg-[#0e1c16] hover:bg-[#193127] border border-[#264237] rounded-xl text-stone-300 transition"
            title="Mở rộng / Thu gọn màn hình"
          >
            {isExpandedScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Chơi lại từ đầu */}
          <button
            onClick={handleResetGame}
            className="p-1.5 bg-[#0e1c16] hover:bg-red-950/60 border border-[#264237] hover:border-red-500/40 rounded-xl text-stone-300 transition"
            title="Khởi động lại hành trình"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </header>

      {/* ===================================================================
          2. VIEWPORT CHƠI CHÍNH
      =================================================================== */}
      <main className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#0d1612]">
        <canvas
          ref={canvasRef}
          className={`w-full block transition-all duration-300 ${
            isExpandedScreen ? 'h-[92vh]' : 'h-[78vh] max-h-[760px]'
          }`}
          style={{ imageRendering: 'pixelated' }}
        />

        {/* HUY HIỆU BÊN PHẢI MÀN HÌNH (như ✦ Quảng trường... trong ảnh mẫu) */}
        {currentMap.portals.length > 0 && (
          <div className="absolute top-4 right-4 bg-[#14231f]/90 border border-[#274037] px-3 py-1 rounded-full text-[11px] font-bold text-amber-300 shadow-xl flex items-center space-x-1 z-20">
            <span className="text-amber-400">✦</span>
            <span>{currentMap.portals[0].label.replace('✦ ', '')}</span>
          </div>
        )}

        {/* MÀN HÌNH CHUYỂN CHAPTER MƯỢT MÀ */}
        {mapTransitionText && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
            <span className="text-amber-400 font-mono text-xs uppercase tracking-widest mb-2">
              ✦ CHUYỂN VÙNG CHIẾN KHU LỊCH SỬ ✦
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-amber-300 uppercase tracking-wide">
              {mapTransitionText}
            </h2>
            <p className="text-stone-400 text-xs mt-2 max-w-md">
              {currentMap.subtitle}
            </p>
          </div>
        )}

        {/* ===================================================================
            HỘP NHIỆM VỤ GÓC TRÊN TRÁI (+ HÀNH TRÌNH - CHUẨN 100% ẢNH MẪU)
        =================================================================== */}
        <div className="absolute top-4 left-4 w-72 bg-[#12221e]/94 backdrop-blur-md border border-[#263e36] rounded-2xl p-4 shadow-2xl text-xs z-20">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 mb-1">
            <span className="flex items-center space-x-1 tracking-wider uppercase">
              <span>+</span>
              <span>HÀNH TRÌNH</span>
            </span>
            <span className="font-mono text-stone-300 bg-[#182c26] px-2 py-0.5 rounded border border-[#27443a]">
              {solvedInCurrentChapter} / {currentChapterNpcs.length} MẢNH
            </span>
          </div>

          <h3 className="text-sm font-extrabold text-stone-100 tracking-wide mt-1">
            {currentMap.title.includes(':') ? currentMap.title.split(':')[1].trim() : currentMap.title}
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
            {currentMap.subtitle}
          </p>

          {/* Ô BƯỚC TIẾP THEO lồng bên trong */}
          <div className="mt-3 p-2.5 bg-[#0e1a17] rounded-xl border border-[#1e342d]">
            <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
              <span>✦</span>
              <span>
                {activeDroppedItem
                  ? 'TÌM KỶ VẬT RƠI'
                  : readyCraftRecipe
                  ? (readyCraftRecipe.targetMapId === currentMapId ? 'GHÉP BẢO VẬT' : 'QUAY VỀ GHÉP BẢO VẬT')
                  : currentMapId === 'MAP_BADINH'
                  ? 'ĐẠI LỄ TUYÊN NGÔN'
                  : isCurMapAllNpcsSolved
                  ? 'TIẾN LÊN CHIẾN KHU MỚI'
                  : 'BƯỚC TIẾP THEO'}
              </span>
            </div>
            <div className="font-bold text-stone-100 mt-0.5 flex items-center space-x-1.5 text-xs">
              <span className="text-amber-400 font-black">→</span>
              {activeDroppedItem ? (
                <span className="text-amber-300 font-black animate-pulse">
                  Tìm: {activeDroppedItem.name}
                </span>
              ) : readyCraftRecipe ? (
                readyCraftRecipe.targetMapId === currentMapId ? (
                  <span className="text-amber-300 font-black animate-pulse">
                    Đến {readyCraftRecipe.stationName} ghép bảo vật [E]
                  </span>
                ) : (
                  <span className="text-amber-300 font-black">
                    Quay về {readyCraftRecipe.stationName} để ghép bảo vật!
                  </span>
                )
              ) : currentMapId === 'MAP_BADINH' ? (
                <span className="text-amber-300 font-black animate-pulse">
                  Tiến đến Lễ Đài cử hành Tuyên Ngôn Độc Lập [E]
                </span>
              ) : isCurMapAllNpcsSolved && forwardNextPortal ? (
                <span className="text-emerald-300 font-black animate-pulse">
                  ✦ Bước vào {forwardNextPortal.label.replace('✦ ', '')} [E]
                </span>
              ) : nextUnsolvedNpcInMap ? (
                <span>Gặp {nextUnsolvedNpcInMap.name}</span>
              ) : (
                <span>Gặp {targetNpc.name}</span>
              )}
            </div>
            {activeDroppedItem && (
              <p className="text-[10px] text-amber-200/80 mt-1 italic leading-tight">
                (Đi theo mũi tên vàng to dẫn đường trên map)
              </p>
            )}

            {/* Các ô slot tiến trình (4 ô bo góc như ảnh mẫu [ · ] [ · ] [ · ] [ · ]) */}
            <div className="flex items-center gap-1.5 mt-2.5">
              {currentChapterNpcs.map((npc, idx) => {
                const isNpcDone = solvedIds.includes(npc.id);
                return (
                  <div
                    key={npc.id}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] border transition ${
                      isNpcDone
                        ? 'bg-amber-500 text-stone-950 border-amber-300 font-black'
                        : 'bg-[#152621] text-stone-500 border-[#223d35]'
                    }`}
                    title={npc.name}
                  >
                    {isNpcDone ? '✓' : '·'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Nút hành động tương tác khi đứng gần Lễ Đài Ba Đình, Trạm Ghép, Cổng, hoặc NPC */}
        {nearbyBaDinhPodium && !activeNpc && (
          <button
            onClick={handleTriggerBaDinhCeremony}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 hover:brightness-110 active:scale-95 text-stone-950 px-6 py-3 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center space-x-2 border-2 border-amber-300 animate-bounce z-20 transition"
          >
            <Star className="w-5 h-5 text-amber-200 fill-amber-300" />
            <span>Cử Hành Đại Lễ Tuyên Ngôn Độc Lập 2/9/1945 [E]</span>
          </button>
        )}

        {nearbyCraftStation && !nearbyBaDinhPodium && !activeNpc && (
          <button
            onClick={() => handleCraftAtStation(nearbyCraftStation)}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center space-x-2 border-2 border-amber-300 animate-bounce z-20 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ghép Bảo Vật: {nearbyCraftStation.name} [E]</span>
          </button>
        )}

        {nearbyPortal && !nearbyBaDinhPodium && !nearbyCraftStation && !activeNpc && (
          <button
            onClick={() => switchMap(nearbyPortal.targetMapId, nearbyPortal.targetSpawn)}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center space-x-2 border-2 border-amber-300 animate-bounce z-20 transition"
          >
            <DoorOpen className="w-4 h-4" />
            <span>{nearbyPortal.label} [E]</span>
          </button>
        )}

        {nearbyNpc && !nearbyPortal && !nearbyBaDinhPodium && !nearbyCraftStation && !activeNpc && (
          <button
            onClick={() => {
              SoundEngine.interact();
              setActiveNpc(nearbyNpc);
              setCurrentQuestionIdx(0);
              setPuzzleResult(null);
              setSelectedOptionIdx(null);
            }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 px-5 py-2.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center space-x-2 border-2 border-amber-300 animate-bounce z-20 transition"
          >
            <Footprints className="w-4 h-4" />
            <span>Đối thoại với {nearbyNpc.name} [E]</span>
          </button>
        )}

        {/* ===================================================================
            THANH ĐIỀU KHIỂN DƯỚI CÙNG (CHUẨN ẢNH MẪU [WASD] Di chuyển • [E] Tương tác • [H] Gợi ý)
        =================================================================== */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#101d19]/92 backdrop-blur-md border border-[#233a32] px-4 py-2 rounded-full text-xs font-medium text-stone-300 shadow-2xl flex items-center space-x-3 sm:space-x-4 z-20">
          <span className="flex items-center space-x-1.5">
            <span className="bg-[#192f28] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 border border-[#2a4d41]">
              WASD
            </span>
            <span>Di chuyển</span>
          </span>
          <span className="text-stone-600">•</span>
          <span className="flex items-center space-x-1.5">
            <span className="bg-[#192f28] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 border border-[#2a4d41]">
              E
            </span>
            <span>Tương tác</span>
          </span>
          <span className="text-stone-600">•</span>
          <span className="flex items-center space-x-1.5">
            <span className="bg-[#192f28] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 border border-[#2a4d41]">
              M
            </span>
            <span>Sơ đồ 6 Map</span>
          </span>
          <span className="text-stone-600">•</span>
          <span className="flex items-center space-x-1.5">
            <span className="bg-[#192f28] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 border border-[#2a4d41]">
              H
            </span>
            <span>Gợi ý</span>
          </span>
          <span className="text-stone-600 hidden md:inline">•</span>
          <span className="hidden md:flex items-center space-x-1.5">
            <span className="bg-[#192f28] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 border border-[#2a4d41]">
              +/-
            </span>
            <span>Thu/Phóng</span>
          </span>
        </div>

        {/* Phím ảo cảm ứng trên di động */}
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-1 bg-[#12221d]/80 p-2 rounded-xl backdrop-blur-sm border border-[#254035] z-20 sm:hidden">
          <button
            onPointerDown={() => { touchDirRef.current = 'up'; }}
            onPointerUp={() => { touchDirRef.current = null; }}
            onPointerLeave={() => { touchDirRef.current = null; }}
            className="w-9 h-9 bg-[#1b322a] active:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold"
          >
            ↑
          </button>
          <div className="flex gap-1">
            <button
              onPointerDown={() => { touchDirRef.current = 'left'; }}
              onPointerUp={() => { touchDirRef.current = null; }}
              onPointerLeave={() => { touchDirRef.current = null; }}
              className="w-9 h-9 bg-[#1b322a] active:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold"
            >
              ←
            </button>
            <button
              onPointerDown={() => { touchDirRef.current = 'down'; }}
              onPointerUp={() => { touchDirRef.current = null; }}
              onPointerLeave={() => { touchDirRef.current = null; }}
              className="w-9 h-9 bg-[#1b322a] active:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold"
            >
              ↓
            </button>
            <button
              onPointerDown={() => { touchDirRef.current = 'right'; }}
              onPointerUp={() => { touchDirRef.current = null; }}
              onPointerLeave={() => { touchDirRef.current = null; }}
              className="w-9 h-9 bg-[#1b322a] active:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold"
            >
              →
            </button>
          </div>
        </div>
      </main>

      {/* ===================================================================
          3. HỘP THOẠI ĐỐI THOẠI & ĐA CÂU HỎI CON ĐƯỜNG ĐỘC LẬP (MODAL)
      =================================================================== */}
      {activeNpc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#12221d] border-2 border-[#2b4b3f] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative text-stone-100 flex flex-col max-h-[90vh]">
            <button
              onClick={handleCloseDialogue}
              className="absolute top-4 right-4 text-stone-400 hover:text-white transition p-1 bg-[#1a332a] rounded-lg"
            >
              ✕
            </button>

            {/* Header nhân vật */}
            <div className="flex items-center space-x-3.5 border-b border-[#254236] pb-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#1b342b] border border-amber-400/40 flex items-center justify-center overflow-hidden">
                <img
                  src={`/assets/sprites/${activeNpc.spriteKey.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}.png`}
                  alt={activeNpc.name}
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center space-x-2">
                  <span>{activeNpc.name}</span>
                  {solvedIds.includes(activeNpc.id) && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40">
                      ✓ Đã hoàn thành
                    </span>
                  )}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">{activeNpc.role}</p>
              </div>
            </div>

            {/* Chỉ báo câu hỏi hiện tại */}
            <div className="flex items-center justify-between text-xs text-amber-400/90 mb-2 font-mono">
              <span>CÂU HỎI {currentQuestionIdx + 1} / {activeNpc.questions.length}</span>
              <div className="flex space-x-1">
                {activeNpc.questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${
                      i === currentQuestionIdx
                        ? 'bg-amber-400'
                        : i < currentQuestionIdx
                        ? 'bg-emerald-400'
                        : 'bg-stone-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Nội dung câu hỏi */}
            <div className="overflow-y-auto pr-1 flex-1">
              <p className="text-sm sm:text-base font-semibold leading-relaxed text-stone-200 bg-[#0e1c17] p-3.5 rounded-xl border border-[#21392f] mb-4">
                {activeNpc.questions[currentQuestionIdx].question}
              </p>

              {/* Các phương án trả lời (Không lộ đáp án đúng khi chọn sai) */}
              <div className="space-y-2.5">
                {activeNpc.questions[currentQuestionIdx].options.map((opt, idx) => {
                  const isSelected = selectedOptionIdx === idx;
                  let btnClass = 'bg-[#162a22] hover:bg-[#1e382e] border-[#28483b] hover:border-amber-400 text-stone-200';
                  if (puzzleResult) {
                    if (puzzleResult.success && isSelected) {
                      btnClass = 'bg-emerald-950/70 border-emerald-500 text-emerald-200';
                    } else if (!puzzleResult.success && isSelected) {
                      btnClass = 'bg-red-950/70 border-red-500 text-red-200';
                    } else {
                      btnClass = 'bg-[#15241f] border-[#223930] opacity-50 text-stone-400';
                    }
                  }
                  return (
                    <button
                      key={idx}
                      disabled={puzzleResult !== null}
                      onClick={() => handleAnswer(opt, idx)}
                      className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm font-medium transition flex items-start space-x-2.5 ${btnClass}`}
                    >
                      <span className="font-bold text-amber-400 shrink-0">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span className="leading-snug">{opt.text.replace(/^[A-Z]\.\s*/, '')}</span>
                    </button>
                  );
                })}
              </div>

              {/* Kết quả phản hồi */}
              {puzzleResult && (
                <div
                  className={`mt-4 p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed animate-fadeIn ${
                    puzzleResult.success
                      ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200'
                      : 'bg-red-950/80 border-red-500/70 text-red-200'
                  }`}
                >
                  <div className="font-black text-xs uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                    {puzzleResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>CHÍNH XÁC • TƯ TƯỞNG VỮNG VÀNG</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span>TRẢ LỜI SAI • KHÔNG ĐƯỢC TIẾP TỤC</span>
                      </>
                    )}
                  </div>
                  <div>{puzzleResult.text}</div>
                </div>
              )}
            </div>

            {/* Footer hành động của modal: Chỉ cho phép đi tiếp khi trả lời ĐÚNG */}
            <div className="border-t border-[#254236] pt-3.5 mt-4 flex items-center justify-end space-x-3">
              {puzzleResult && puzzleResult.success && currentQuestionIdx < activeNpc.questions.length - 1 && (
                <button
                  onClick={handleNextQuestion}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center space-x-1.5"
                >
                  <span>Câu tiếp theo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {puzzleResult && puzzleResult.success && currentQuestionIdx === activeNpc.questions.length - 1 && (
                <button
                  onClick={handleCloseDialogue}
                  className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition"
                >
                  Hoàn tất đối thoại
                </button>
              )}

              {puzzleResult && !puzzleResult.success && (
                <button
                  onClick={handleCloseDialogue}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition"
                >
                  Đóng & Thử lại từ đầu
                </button>
              )}

              {!puzzleResult && (
                <button
                  onClick={handleCloseDialogue}
                  className="bg-[#1b342b] hover:bg-[#25463a] text-stone-300 px-4 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Rời đi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          4. SỔ TAY 8 VĂN KIỆN ĐẢNG (CODEX MODAL)
      =================================================================== */}
      {showDirectivesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12221d] border-2 border-[#2b4b3f] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-stone-100 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowDirectivesModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white transition p-1 bg-[#1a332a] rounded-lg"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2 text-amber-400 mb-1">
              <Scroll className="w-5 h-5" />
              <h3 className="text-base font-extrabold uppercase tracking-wide">
                SỔ TAY 8 VĂN KIỆN LỊCH SỬ CÁCH MẠNG (1930 — 1945)
              </h3>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Thu thập qua các cuộc đối thoại với các vị lãnh tụ lịch sử tại các chiến khu
            </p>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {HISTORICAL_DIRECTIVES.map((d) => {
                const isUnlocked = collectedDirectives.includes(d.id);
                return (
                  <div
                    key={d.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isUnlocked
                        ? 'bg-[#152e24] border-amber-500/50 text-stone-100'
                        : 'bg-[#0f1c17] border-[#1e342b] opacity-60 text-stone-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {d.year} • {d.author}
                      </span>
                      {isUnlocked ? (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/40">
                          ✓ ĐÃ MỞ KHÓA
                        </span>
                      ) : (
                        <span className="text-[10px] bg-stone-800 text-stone-500 px-2 py-0.5 rounded">
                          CHƯA MỞ KHÓA
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-stone-100 mt-1">
                      {isUnlocked ? d.title : 'Văn kiện lịch sử bí mật'}
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {isUnlocked ? d.desc : 'Hãy tìm gặp các vị lãnh tụ tại các chiến khu để mở khóa.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          5. SƠ ĐỒ 6 CHIẾN KHU (WORLD MAP FAST-TRAVEL)
      =================================================================== */}
      {showWorldMapModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12221d] border-2 border-[#2b4b3f] rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative text-stone-100">
            <button
              onClick={() => setShowWorldMapModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white transition p-1 bg-[#1a332a] rounded-lg"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2 text-amber-400 mb-1">
              <MapIcon className="w-5 h-5" />
              <h3 className="text-base font-extrabold uppercase tracking-wide">
                SƠ ĐỒ 6 CHIẾN KHU CON ĐƯỜNG ĐỘC LẬP (1930 — 1945)
              </h3>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Nhấp vào bất kỳ chiến khu nào để dịch chuyển tức thời hoặc đi bộ qua các cổng [E]
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(MAP_DEFINITIONS).map((m) => {
                const isCurrent = m.id === currentMapId;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setShowWorldMapModal(false);
                      switchMap(m.id);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-500/40'
                        : 'bg-[#152a22] hover:bg-[#1e392e] border-[#274438] hover:border-amber-400/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 mb-1">
                        <span>CHƯƠNG {m.chapterNum}</span>
                        {isCurrent && (
                          <span className="bg-amber-400 text-stone-950 px-1.5 py-0.2 rounded font-black text-[9px]">
                            ĐANG Ở ĐÂY
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-stone-100 line-clamp-1">
                        {m.title.replace('HÀNH TRÌNH: ', '').replace('CHƯƠNG ', '')}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-1 line-clamp-2">
                        {m.subtitle}
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-amber-300/80 flex items-center justify-end space-x-1">
                      <span>Dịch chuyển đến</span>
                      <span>→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          6. MODAL GỢI Ý (HELP)
      =================================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12221d] border-2 border-[#2b4b3f] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white transition p-1 bg-[#1a332a] rounded-lg"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2 text-amber-400 mb-2">
              <HelpCircle className="w-5 h-5" />
              <h3 className="text-base font-extrabold uppercase">HƯỚNG DẪN HÀNH TRÌNH CON ĐƯỜNG ĐỘC LẬP</h3>
            </div>
            <ul className="text-xs space-y-2.5 text-stone-300 leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><b>Di chuyển:</b> Dùng các phím <b>WASD</b> hoặc <b>Phím Mũi Tên</b> (trên điện thoại dùng phím ảo).</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><b>Tương tác:</b> Nhấn <b>[E]</b> hoặc <b>Phím Cách</b> khi đứng gần nhân vật hoặc cổng dịch chuyển.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><b>La bàn vàng dưới chân:</b> Mũi tên vàng xoay chỉ đường thẳng tới nhân vật mục tiêu kế tiếp cùng khoảng cách đo bằng mét.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><b>Sơ đồ 6 Chiến khu:</b> Nhấn <b>[M]</b> để xem toàn cảnh 6 chương lịch sử và dịch chuyển nhanh.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><b>Tránh né Mật thám Pháp:</b> Đừng đi vào vòng cảnh báo màu đỏ của mật thám để tránh nguy cơ thất bại.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ===================================================================
          7. THẮNG LỢI TỔNG KHỞI NGHĨA (VICTORY MODAL)
      =================================================================== */}
      {gameStatus === 'WON' && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12221d] border-2 border-amber-400 rounded-3xl max-w-xl w-full p-8 text-center shadow-2xl relative animate-scaleUp">
            <span className="text-4xl">⭐</span>
            <h2 className="text-2xl font-black text-amber-300 mt-2 uppercase tracking-wide">
              TỔNG KHỞI NGHĨA THẮNG LỢI HOÀN TOÀN!
            </h2>
            <p className="text-xs text-amber-200/80 font-mono mt-1">
              NGÀY 2 THÁNG 9 NĂM 1945 — NƯỚC VIỆT NAM DÂN CHỦ CỘNG HÒA RA ĐỜI
            </p>
            <div className="my-5 p-4 bg-[#0e1c17] rounded-2xl border border-amber-500/30 text-xs text-stone-200 leading-relaxed text-left italic">
              "Nước Việt Nam có quyền hưởng tự do và độc lập, và sự thật đã thành một nước tự do, độc lập. Toàn thể dân tộc Việt Nam quyết đem tất cả tinh thần và lực lượng, tính mệnh và của cải để giữ vững quyền tự do, độc lập ấy!"
            </div>

            {/* BẢNG KẾT QUẢ ĐUA TOP CỦA NGƯỜI CHƠI */}
            <div className="my-4 p-4 bg-gradient-to-r from-amber-950/70 via-yellow-950/60 to-amber-950/70 rounded-2xl border border-amber-400/60 shadow-inner flex items-center justify-around text-center">
              <div>
                <div className="text-[11px] text-amber-300 font-extrabold uppercase tracking-wider">HẠNG THI ĐẤU</div>
                <div className="text-3xl font-black text-amber-300 flex items-center justify-center gap-1.5 mt-0.5">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <span>#{myRankInRoom}</span>
                  <span className="text-xs text-stone-400 font-normal">/ {totalPlayersInRoom}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-amber-500/30" />
              <div>
                <div className="text-[11px] text-amber-300 font-extrabold uppercase tracking-wider">THỜI GIAN VỀ ĐÍCH</div>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                  {formatRaceTime(finishTimeMsRecord || raceElapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-3">
              <button
                onClick={handleResetGame}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition shadow-lg"
              >
                Chơi lại từ đầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          8. BỊ MẬT THÁM BẮT (CAPTURED MODAL - 100% THREAT)
      =================================================================== */}
      {capturedModal && (
        <div className="fixed inset-0 z-50 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1a0c0c] border-2 border-red-500 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-stone-100 text-center animate-scaleUp">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-red-400 uppercase tracking-wide">
              BẠN ĐÃ BỊ MẬT THÁM PHÁP BẮT GIỮ!
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 mt-2 leading-relaxed">
              Điểm bị phát hiện đã đạt <b>100%</b>! Mật thám thực dân Pháp đã phát hiện toàn bộ hoạt động bí mật của bạn tại <b>{currentMap.title}</b>.
            </p>
            <div className="my-4 p-3.5 bg-black/50 rounded-xl border border-red-900/60 text-xs text-red-300 font-medium text-left">
              ⚠️ Mọi manh mối và liên lạc tại chiến khu này đã bị phong tỏa. Bạn cần vượt ngục và bắt đầu thực hiện lại các nhiệm vụ tại chiến khu này từ đầu!
            </div>
            <button
              onClick={handleRestartMap}
              className="w-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black py-3 px-5 rounded-xl uppercase tracking-wider text-xs sm:text-sm shadow-xl transition flex items-center justify-center space-x-2 border border-red-400"
            >
              <RotateCcw className="w-4 h-4" />
              <span>VƯỢT NGỤC & CHƠI LẠI CHIẾN KHU NÀY</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          9. CỔNG TIẾN TỚI MAP MỚI BỊ KHÓA (PORTAL BLOCKED MODAL)
      =================================================================== */}
      {portalBlockedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#14201c] border-2 border-amber-500/70 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 text-center animate-scaleUp">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
              <DoorClosed className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-lg font-black text-amber-300 uppercase tracking-wide">
              CỔNG CHIẾN KHU ĐANG KHÓA!
            </h3>
            <p className="text-xs text-stone-300 mt-2 leading-relaxed">
              Để tiến tới <b>{portalBlockedModal.targetTitle}</b>, bạn phải hoàn thành nhiệm vụ và điều kiện lịch sử tại chiến khu này!
            </p>
            <div className="my-3 p-3 bg-[#0d1714] rounded-xl border border-[#223931] text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-stone-400">Tiến độ nhiệm vụ:</span>
                <span className="font-bold text-amber-300">
                  {portalBlockedModal.solvedCount} / {portalBlockedModal.totalCount} hoàn thành
                </span>
              </div>
              {portalBlockedModal.hasPendingItem && (
                <div className="text-red-400 font-semibold pt-1 border-t border-[#1e342c] flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>Vẫn còn bảo vật rơi trên bản đồ chưa tìm thấy!</span>
                </div>
              )}
              {portalBlockedModal.craftHint && (
                <div className="text-amber-300 font-semibold pt-1.5 border-t border-[#1e342c] flex items-start space-x-1.5">
                  <span className="text-amber-400 font-bold shrink-0">✦</span>
                  <span className="leading-snug">{portalBlockedModal.craftHint}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-stone-400 mb-4 italic">
              (Ghi chú: Bạn vẫn luôn có thể tự do quay về các chiến khu cũ đã vượt qua mà không bị hạn chế).
            </p>
            <button
              onClick={() => setPortalBlockedModal(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg"
            >
              ĐÃ HIỂU & TIẾP TỤC NHIỆM VỤ
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          10. THÔNG BÁO VẬT PHẨM RƠI / THU THẬP KỶ VẬT (RELIC MODAL)
      =================================================================== */}
      {relicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#12221d] border-2 border-amber-400/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 text-center animate-scaleUp">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl">
              {relicModal.isDropAlert ? '⭐' : '🏆'}
            </div>
            <h3 className="text-base sm:text-lg font-black text-amber-300 uppercase tracking-wide">
              {relicModal.title || 'KỶ VẬT LỊCH SỬ CÁCH MẠNG'}
            </h3>
            <div className="text-sm font-bold text-amber-400 mt-1">
              [ {relicModal.name} ]
            </div>
            <p className="text-xs text-stone-300 mt-2.5 leading-relaxed whitespace-pre-line bg-[#0d1814] p-3 rounded-xl border border-[#233a32] text-left">
              {relicModal.desc}
            </p>
            <button
              onClick={() => setRelicModal(null)}
              className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg"
            >
              TIẾP TỤC HÀNH TRÌNH
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          11. GHÉP THÀNH CÔNG BẢO VẬT LỊCH SỬ (CRAFT SUCCESS MODAL)
      =================================================================== */}
      {craftSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#12221d] border-2 border-amber-400 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative text-stone-100 text-center animate-scaleUp">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl">
              ✨
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
              BẢO VẬT LỊCH SỬ HOÀN THÀNH
            </span>
            <h3 className="text-xl font-black text-amber-300 uppercase tracking-wide mt-1">
              [ {craftSuccessModal.name} ]
            </h3>
            <div className="my-4 p-4 bg-[#0d1814] rounded-2xl border border-amber-500/40 text-xs sm:text-sm text-stone-200 text-left leading-relaxed">
              <p className="font-semibold text-amber-200 mb-2">
                {craftSuccessModal.desc}
              </p>
              <p className="text-emerald-400 font-bold border-t border-[#1e342c] pt-2">
                {craftSuccessModal.rewardText}
              </p>
            </div>
            <button
              onClick={() => setCraftSuccessModal(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-black py-3 px-5 rounded-xl uppercase tracking-wider text-xs sm:text-sm shadow-xl transition border border-amber-300"
            >
              TIẾP TỤC HÀNH TRÌNH CÁCH MẠNG
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          12. CẢNH BÁO THIẾU BẢO VẬT TẠI LỄ ĐÀI BA ĐÌNH (PODIUM WARNING MODAL)
      =================================================================== */}
      {podiumWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1a0e0e] border-2 border-red-500/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-stone-100 text-center animate-scaleUp">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-500/20 border border-red-400 flex items-center justify-center text-2xl">
              📜
            </div>
            <h3 className="text-lg font-black text-amber-300 uppercase tracking-wide">
              CHƯA ĐỦ BẢO VẬT CỬ HÀNH ĐẠI LỄ!
            </h3>
            <p className="text-xs text-stone-300 mt-2 leading-relaxed">
              Để cử hành Đại Lễ Tuyên Ngôn Độc Lập ngày 2/9/1945 tại Quảng Trường Ba Đình, bạn cần phải có đầy đủ 2 bảo vật then chốt của lịch sử:
            </p>
            <div className="my-3 p-3 bg-[#0d1714] rounded-xl border border-[#223931] text-xs space-y-2 text-left">
              <div className="flex items-center space-x-2">
                <span>{collectedItems.includes('ITEM_TUYEN_NGON_HOAN_CHINH') ? '✅' : '❌'}</span>
                <span className={collectedItems.includes('ITEM_TUYEN_NGON_HOAN_CHINH') ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold'}>
                  Bản Tuyên Ngôn Độc Lập 2/9/1945 Hoàn Chỉnh (Ghép tại 48 Hàng Ngang)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span>{collectedItems.includes('ITEM_LA_CO_TO_QUOC') ? '✅' : '❌'}</span>
                <span className={collectedItems.includes('ITEM_LA_CO_TO_QUOC') ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold'}>
                  Lá Cờ Đỏ Sao Vàng Khởi Nghĩa Thống Nhất (Ghép tại Bàn Đá Pác Bó)
                </span>
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mb-4 italic">
              Hãy bấm phím [M] để mở Sơ đồ 6 Chiến khu và quay về các địa điểm lịch sử để ghép các bảo vật này!
            </p>
            <button
              onClick={() => setPodiumWarningModal(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg"
            >
              ĐÃ HIỂU & QUAY VỀ HOÀN THÀNH
            </button>
          </div>
        </div>
      )}
      {/* ===================================================================
          9. HIỆU ỨNG ĐẾM NGƯỢC XUẤT PHÁT ĐUA TOP (3-2-1-GO)
      =================================================================== */}
      {raceCountdown && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#12231e]/95 border-4 border-amber-400 rounded-3xl p-8 sm:p-12 text-center shadow-2xl animate-scaleUp">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-3 animate-bounce" />
            <h1 className="text-4xl sm:text-6xl font-black text-amber-300 tracking-wider">
              {raceCountdown}
            </h1>
            <p className="text-stone-300 font-bold mt-3 text-sm uppercase">
              Giải Đua Top Con Đường Độc Lập (1930 - 1945)
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================
          10. TRANG QUẢN TRỊ PHÒNG THI (GIAO DIỆN TỐI GIẢN, CHUẨN QUẢN TRỊ, KHÔNG TÍNH ADMIN)
      =================================================================== */}
      {isHostMachine && showHostModal && (() => {
        // Loại bỏ hoàn toàn tài khoản Admin khỏi danh sách người chơi
        const rawList = raceRoomData?.leaderboard || [];
        const allPlayers = rawList.filter((p) => p.id !== playerId);
        const isRacingOrFinished = raceRoomData?.status === 'RACING' || raceRoomData?.status === 'FINISHED';
        const activeView =
          hostTabMode === 'LOBBY_QR'
            ? 'LOBBY_QR'
            : hostTabMode === 'LIVE_RANKING'
            ? 'LIVE_RANKING'
            : isRacingOrFinished
            ? 'LIVE_RANKING'
            : 'LOBBY_QR';

        const MAP_STEP_NUM = {
          'MAP_QUANGTRUONG': 1,
          'map-0-quang-truong': 1,
          'MAP_PACBO': 2,
          'map-1-pac-bo': 2,
          'MAP_HANOI': 3,
          'map-2-ha-noi': 3,
          'MAP_BADIEM': 4,
          'map-3-ba-diem': 4,
          'MAP_TANTRAO': 5,
          'map-4-tan-trao': 5,
          'MAP_BADINH': 6,
          'map-5-ba-dinh': 6
        };

        const finishedCount = allPlayers.filter((p) => p.isFinished).length;

        return (
          <div className="fixed inset-0 z-50 bg-[#111315] text-neutral-100 flex flex-col font-sans">
            {/* Thanh tiêu đề Quản trị */}
            <div className="h-14 border-b border-neutral-800 bg-[#16191d] px-4 sm:px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-bold tracking-tight text-neutral-100 uppercase">
                  Quản trị phòng thi
                </span>
                <span className="h-4 w-px bg-neutral-700" />
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-neutral-400">Mã phòng:</span>
                  <span className="font-mono font-bold text-amber-400 bg-neutral-900 border border-neutral-700 px-2 py-0.5 rounded">
                    {hostRoomCode}
                  </span>
                </div>
                <div className="hidden md:flex items-center space-x-2 text-xs">
                  <span className="text-neutral-400">Trạng thái:</span>
                  <span className="font-medium text-neutral-200">
                    {raceRoomData?.status === 'RACING'
                      ? 'Đang diễn ra'
                      : raceRoomData?.status === 'FINISHED'
                      ? 'Đã kết thúc'
                      : 'Chờ bắt đầu'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Chuyển tab Sảnh chờ / Bảng xếp hạng */}
                <div className="flex bg-neutral-900 p-0.5 rounded-md border border-neutral-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setHostTabMode('LOBBY_QR')}
                    className={`px-3 py-1 rounded transition ${
                      activeView === 'LOBBY_QR'
                        ? 'bg-neutral-700 text-white font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Sảnh chờ & Mã QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostTabMode('LIVE_RANKING')}
                    className={`px-3 py-1 rounded transition ${
                      activeView === 'LIVE_RANKING'
                        ? 'bg-neutral-700 text-white font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Bảng xếp hạng ({allPlayers.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowServerConfig((v) => !v)}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs rounded-md transition"
                >
                  Cấu hình
                </button>

                {isAdminAuthenticated && (
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-red-400 text-xs rounded-md transition"
                  >
                    Đăng xuất
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowHostModal(false)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium rounded-md transition"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Khung cấu hình máy chủ (ẩn/hiện gọn gàng khi bấm nút Cấu hình) */}
            {showServerConfig && (
              <div className="border-b border-neutral-800 bg-[#14171a] px-6 py-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-neutral-400 block mb-1">Đổi mã phòng:</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customRoomInput}
                      onChange={(e) => setCustomRoomInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã mới..."
                      maxLength={10}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-100 font-mono px-2.5 py-1 rounded flex-1 focus:outline-none focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateNewRoom(customRoomInput)}
                      className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Địa chỉ giao diện (Frontend):</label>
                  <input
                    type="text"
                    value={frontendDomain}
                    onChange={(e) => setFrontendDomain(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono px-2.5 py-1 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Địa chỉ máy chủ (Backend):</label>
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBackendUrl(val);
                      try {
                        localStorage.setItem('cddl_backend_url', val);
                      } catch {}
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono px-2.5 py-1 rounded focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>
            )}

            {/* NỘI DUNG CHÍNH */}
            <div className="flex-1 overflow-hidden p-4 sm:p-6 max-w-6xl w-full mx-auto flex flex-col">
              {/* ===============================================================
                  MÀN HÌNH 1: SẢNH CHỜ (HIỆN QR + MÃ CODE & DANH SÁCH NGƯỜI THAM GIA)
              =============================================================== */}
              {activeView === 'LOBBY_QR' && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                  {/* Cột trái: Mã QR và Mã Phòng */}
                  <div className="lg:col-span-5 bg-[#16191d] border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-between">
                    <div className="w-full text-center">
                      <div className="text-xs text-neutral-400 uppercase tracking-wider">
                        Mã tham gia phòng thi
                      </div>
                      <div className="mt-2 py-3 px-4 bg-[#111315] border border-neutral-800 rounded-md font-mono text-4xl font-bold text-amber-400 tracking-widest">
                        {hostRoomCode}
                      </div>
                    </div>

                    <div className="my-4">
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="Mã QR"
                          className="w-60 h-60 sm:w-64 sm:h-64 bg-white p-3 rounded-md border border-neutral-700"
                        />
                      ) : (
                        <div className="w-60 h-60 sm:w-64 sm:h-64 bg-neutral-900 border border-neutral-800 rounded-md flex items-center justify-center text-xs text-neutral-500">
                          Đang tạo mã QR...
                        </div>
                      )}
                    </div>

                    <div className="w-full space-y-2">
                      <div className="text-[11px] text-neutral-400 text-center">
                        Quét mã QR hoặc truy cập địa chỉ bên dưới và nhập mã <b>{hostRoomCode}</b>
                      </div>
                      <div className="flex items-center gap-2 bg-[#111315] border border-neutral-800 rounded-md px-3 py-2">
                        <span className="font-mono text-xs text-neutral-300 truncate flex-1 select-all">
                          {currentJoinRoomUrl}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyJoinLink}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs rounded transition shrink-0"
                        >
                          {copiedLink ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Danh sách người chơi đã vào phòng (Không tính Admin) */}
                  <div className="lg:col-span-7 bg-[#16191d] border border-neutral-800 rounded-lg p-6 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                      <div>
                        <h3 className="text-base font-semibold text-neutral-100">
                          Người chơi đã vào phòng
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Chỉ tính người chơi thực tế (không tính tài khoản quản trị)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-mono font-bold text-neutral-100">
                          {allPlayers.length}
                        </span>
                        <span className="text-xs text-neutral-400 block">người chơi</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto my-4 pr-1">
                      {allPlayers.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {allPlayers.map((p, idx) => (
                            <div
                              key={p.id}
                              className="bg-[#111315] border border-neutral-800 rounded-md px-3 py-2 flex items-center space-x-2.5 text-xs"
                            >
                              <span className="font-mono text-neutral-500 w-5">
                                {String(idx + 1).padStart(2, '0')}.
                              </span>
                              <span className="font-medium text-neutral-200 truncate flex-1">
                                {p.name}
                              </span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  p.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-md">
                          Chưa có người chơi nào tham gia phòng.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-neutral-800 pt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleHostResetRace}
                        className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium rounded-md transition"
                      >
                        Đặt lại phòng
                      </button>
                      <button
                        type="button"
                        onClick={handleHostStartRace}
                        className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-md text-sm transition"
                      >
                        Bắt đầu phần thi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  MÀN HÌNH 2: KHI ĐANG CHƠI (BẢNG XẾP HẠNG TỪ TOP 1 ĐẾN HẾT)
              =============================================================== */}
              {activeView === 'LIVE_RANKING' && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                  {/* Thanh chỉ số tóm tắt */}
                  <div className="bg-[#16191d] border border-neutral-800 rounded-lg px-5 py-3.5 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center space-x-6 sm:space-x-8 text-xs">
                      <div>
                        <span className="text-neutral-400 block">Mã phòng</span>
                        <span className="font-mono text-base font-bold text-amber-400">{hostRoomCode}</span>
                      </div>
                      <div className="h-7 w-px bg-neutral-800" />
                      <div>
                        <span className="text-neutral-400 block">Số người chơi</span>
                        <span className="font-mono text-base font-bold text-neutral-100">{allPlayers.length}</span>
                      </div>
                      <div className="h-7 w-px bg-neutral-800" />
                      <div>
                        <span className="text-neutral-400 block">Đã hoàn thành</span>
                        <span className="font-mono text-base font-bold text-emerald-400">
                          {finishedCount} / {allPlayers.length}
                        </span>
                      </div>
                      <div className="h-7 w-px bg-neutral-800" />
                      <div>
                        <span className="text-neutral-400 block">Thời gian</span>
                        <span className="font-mono text-base font-bold text-neutral-100">
                          {formatRaceTime(raceElapsedSeconds)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setHostTabMode('LOBBY_QR')}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs rounded-md transition"
                      >
                        Hiện mã QR
                      </button>
                      {raceRoomData?.status === 'RACING' ? (
                        <button
                          type="button"
                          onClick={handleHostEndRace}
                          className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-medium rounded-md transition"
                        >
                          Kết thúc
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleHostStartRace}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-md transition"
                        >
                          Bắt đầu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleHostResetRace}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs rounded-md transition"
                      >
                        Đặt lại
                      </button>
                    </div>
                  </div>

                  {/* Bảng danh sách người chơi xếp hạng từ 1 đến hết */}
                  <div className="flex-1 bg-[#16191d] border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#121417] text-neutral-400 font-medium sticky top-0 z-10 border-b border-neutral-800">
                          <tr>
                            <th className="py-3 px-4 w-16">Hạng</th>
                            <th className="py-3 px-4">Người chơi</th>
                            <th className="py-3 px-4">Khu vực hiện tại</th>
                            <th className="py-3 px-4 w-56">Tiến độ</th>
                            <th className="py-3 px-4 text-right w-28">Thời gian</th>
                            <th className="py-3 px-4 text-right w-36">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/70">
                          {allPlayers.map((p, idx) => {
                            const rank = idx + 1;
                            const stepNum = MAP_STEP_NUM[p.currentMapId] || 1;
                            const progressPct = p.isFinished
                              ? 100
                              : Math.min(95, Math.round(((stepNum - 1) * 15) + ((p.solvedCount || 0) / 8) * 25));

                            return (
                              <tr
                                key={p.id}
                                className={`hover:bg-neutral-800/40 transition ${
                                  p.isFinished ? 'bg-neutral-800/20' : ''
                                }`}
                              >
                                <td className="py-3 px-4 font-mono font-bold text-neutral-200">
                                  #{String(rank).padStart(2, '0')}
                                </td>
                                <td className="py-3 px-4 font-medium text-neutral-100">
                                  {p.name}
                                </td>
                                <td className="py-3 px-4 text-neutral-300">
                                  Màn {stepNum}/6 — {p.currentMapName}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2.5">
                                    <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-300 ${
                                          p.isFinished ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-neutral-400 w-9 text-right">
                                      {p.solvedCount}/{p.totalPieces || 8}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-neutral-200">
                                  {formatRaceTime(p.finishTimeMs || (p.isFinished ? null : raceElapsedSeconds))}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {p.isFinished ? (
                                    <span className="text-emerald-400 font-medium">
                                      Hoàn thành
                                    </span>
                                  ) : p.isOnline ? (
                                    <span className="text-amber-400">
                                      Đang làm bài
                                    </span>
                                  ) : (
                                    <span className="text-neutral-500">
                                      Mất kết nối
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {allPlayers.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-neutral-500">
                                Chưa có người chơi nào trong danh sách.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===================================================================
          11. CHẾ ĐỘ MÁY CHIẾU SÂN KHẤU (PROJECTOR / TOÀN MÀN HÌNH)
      =================================================================== */}
      {showProjectorMode && (
        <div className="fixed inset-0 z-50 bg-[#0a1511] text-stone-100 flex flex-col p-6 overflow-hidden animate-fadeIn select-none">
          {/* Projector Top Header */}
          <div className="flex items-center justify-between border-b-2 border-amber-400/40 pb-4 mb-4">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">⭐</span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                  <span>GIẢI ĐUA TOP CON ĐƯỜNG ĐỘC LẬP (1930 – 1945)</span>
                  <span className="text-sm bg-amber-500 text-stone-950 px-2.5 py-0.5 rounded-full font-black">
                    PHÒNG {roomCode}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-stone-300">
                  ✦ BẢNG XẾP HẠNG TRỰC TIẾP 60 THÍ SINH • CON ĐƯỜNG ĐỘC LẬP (1930 – 1945)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Huge Timer */}
              <div className="bg-[#12241d] border-2 border-amber-400/60 rounded-2xl px-6 py-2 text-center shadow-xl">
                <div className="text-[11px] font-bold text-amber-300 uppercase">Thời Gian Thi Đấu</div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-wider">
                  {formatRaceTime(raceElapsedSeconds)}
                </div>
              </div>

              <button
                onClick={() => setShowProjectorMode(false)}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Thu Nhỏ</span>
              </button>
            </div>
          </div>

          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-3 gap-4 mb-5 max-w-4xl mx-auto w-full">
            {/* Á quân 1 (#2) */}
            <div className="bg-gradient-to-b from-slate-800/80 to-[#12221b] border-2 border-slate-400/60 rounded-2xl p-4 text-center shadow-xl order-1">
              <div className="text-2xl">🥈</div>
              <div className="text-xs font-extrabold text-slate-300 uppercase mt-1">Á Quân 1</div>
              <div className="text-base font-black text-white truncate mt-1">
                {raceRoomData?.leaderboard?.[1]?.name || '---'}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {formatRaceTime(raceRoomData?.leaderboard?.[1]?.finishTimeMs)}
              </div>
            </div>

            {/* Quán quân (#1) */}
            <div className="bg-gradient-to-b from-amber-900/60 via-yellow-950/70 to-[#14261e] border-2 border-yellow-400 rounded-2xl p-4 text-center shadow-2xl scale-105 z-10 order-2">
              <div className="text-3xl">👑 🥇</div>
              <div className="text-xs font-black text-yellow-300 uppercase mt-1 tracking-wider">QUÁN QUÂN</div>
              <div className="text-lg font-black text-amber-200 truncate mt-1">
                {raceRoomData?.leaderboard?.[0]?.name || '---'}
              </div>
              <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">
                {formatRaceTime(raceRoomData?.leaderboard?.[0]?.finishTimeMs)}
              </div>
            </div>

            {/* Á quân 2 (#3) */}
            <div className="bg-gradient-to-b from-amber-950/70 to-[#12221b] border-2 border-amber-600/60 rounded-2xl p-4 text-center shadow-xl order-3">
              <div className="text-2xl">🥉</div>
              <div className="text-xs font-extrabold text-amber-400 uppercase mt-1">Á Quân 2</div>
              <div className="text-base font-black text-white truncate mt-1">
                {raceRoomData?.leaderboard?.[2]?.name || '---'}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {formatRaceTime(raceRoomData?.leaderboard?.[2]?.finishTimeMs)}
              </div>
            </div>
          </div>

          {/* 2-Column Grid for 60 participants (Col 1: 1-30, Col 2: 31-60) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden bg-[#0d1914] border border-[#233a30] rounded-2xl p-4">
            {/* Column 1 (Top 1 - 30) */}
            <div className="overflow-y-auto pr-2 border-r border-[#1e342a]">
              <div className="text-xs font-bold text-amber-400 uppercase mb-2">Thí sinh hạng #1 đến #30</div>
              <div className="space-y-1.5">
                {(raceRoomData?.leaderboard || []).slice(0, 30).map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition ${
                      p.isFinished
                        ? 'bg-amber-950/40 border-amber-400/60 font-semibold'
                        : 'bg-[#12221a] border-[#1d3529]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono font-black text-amber-300 w-6">#{idx + 1}</span>
                      <span className="font-bold text-white truncate max-w-[140px]">{p.name}</span>
                      <span className="text-[10px] text-stone-400 truncate hidden lg:inline">({p.currentMapName})</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="font-mono text-stone-300 text-[11px]">{p.solvedCount}/8</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatRaceTime(p.finishTimeMs || (p.isFinished ? null : raceElapsedSeconds))}
                      </span>
                      {p.isFinished && (
                        <span className="text-[10px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black">
                          🏆 VỀ ĐÍCH
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2 (Top 31 - 60) */}
            <div className="overflow-y-auto pl-2">
              <div className="text-xs font-bold text-stone-400 uppercase mb-2">Thí sinh hạng #31 đến #60</div>
              <div className="space-y-1.5">
                {(raceRoomData?.leaderboard || []).slice(30, 60).map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition ${
                      p.isFinished
                        ? 'bg-amber-950/40 border-amber-400/60 font-semibold'
                        : 'bg-[#12221a] border-[#1d3529]'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono font-black text-stone-400 w-6">#{idx + 31}</span>
                      <span className="font-bold text-white truncate max-w-[140px]">{p.name}</span>
                      <span className="text-[10px] text-stone-400 truncate hidden lg:inline">({p.currentMapName})</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="font-mono text-stone-300 text-[11px]">{p.solvedCount}/8</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatRaceTime(p.finishTimeMs || (p.isFinished ? null : raceElapsedSeconds))}
                      </span>
                      {p.isFinished && (
                        <span className="text-[10px] bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black">
                          🏆 VỀ ĐÍCH
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          12. MODAL XEM BẢNG XẾP HẠNG DÀNH CHO NGƯỜI THAM GIA (PARTICIPANT)
      =================================================================== */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12221d] border-2 border-[#2c4d3e] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-stone-100 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 bg-[#1a332a] rounded-lg"
            >
              ✕
            </button>

            <div className="flex items-center space-x-2 text-amber-400 mb-3">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="text-base font-extrabold uppercase">BẢNG XẾP HẠNG PHÒNG [{roomCode}]</h3>
            </div>

            <div className="p-3 bg-[#0d1814] rounded-xl border border-[#233a30] mb-3 flex items-center justify-around text-center text-xs">
              <div>
                <span className="text-stone-400">Hạng của bạn</span>
                <div className="text-xl font-black text-amber-300">#{myRankInRoom}</div>
              </div>
              <div className="h-6 w-px bg-stone-700" />
              <div>
                <span className="text-stone-400">Tổng thí sinh</span>
                <div className="text-xl font-black text-stone-100">{totalPlayersInRoom}</div>
              </div>
              <div className="h-6 w-px bg-stone-700" />
              <div>
                <span className="text-stone-400">Thời gian</span>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {formatRaceTime(raceElapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Danh sách thí sinh */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {(raceRoomData?.leaderboard || []).slice(0, 30).map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                    p.id === playerId
                      ? 'bg-amber-950/40 border border-amber-400/60 font-bold'
                      : 'bg-[#152720] border border-[#203a2f]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-amber-300 w-5">#{idx + 1}</span>
                    <span className="text-white">{p.name}</span>
                    {p.id === playerId && <span className="text-[10px] text-amber-400">(Bạn)</span>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-stone-400">{p.solvedCount}/8</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatRaceTime(p.finishTimeMs || (p.isFinished ? null : raceElapsedSeconds))}
                    </span>
                    {p.isFinished && <span>🏆</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Cấu hình Mã Phòng & Kết nối Máy chủ Xử lý JS (Host PC) */}
            <div className="mt-3 p-3 bg-[#0d1814] rounded-xl border border-[#20362c] text-left space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-amber-300 block mb-0.5">Mã phòng đua:</label>
                  <input
                    type="text"
                    value={roomCode}
                    maxLength={10}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="DOCLAP"
                    className="w-full bg-[#12221b] border border-[#284639] text-xs font-mono font-bold text-amber-200 px-2 py-1 rounded focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-emerald-300 block mb-0.5">
                    Máy chủ xử lý Backend (PC của Host):
                  </label>
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setBackendUrl(val);
                      try {
                        localStorage.setItem('cddl_backend_url', val);
                      } catch {}
                    }}
                    placeholder="http://localhost:4000 hoặc link HTTPS Tunnel..."
                    className="w-full bg-[#12221b] border border-[#284639] text-xs font-mono text-emerald-300 px-2 py-1 rounded focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
              <p className="text-[10px] text-stone-400">
                ✦ Giao diện hiển thị qua Vercel, toàn bộ tính toán phòng đua 60 người chạy trực tiếp tại máy chủ của Host.
              </p>
            </div>

            <button
              onClick={() => setShowJoinModal(false)}
              className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-2 rounded-xl text-xs uppercase"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          12B. ĐĂNG NHẬP QUẢN TRỊ VIÊN (TK: admin / MK: trienngu)
      =================================================================== */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdminLoginSubmit}
            className="bg-[#16191d] border border-neutral-700 rounded-lg max-w-sm w-full p-6 shadow-xl relative text-neutral-100"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-100">
                Đăng nhập Quản trị
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-left text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Tài khoản</label>
                <input
                  type="text"
                  autoFocus
                  value={adminUserInp}
                  onChange={(e) => setAdminUserInp(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#111315] border border-neutral-700 text-neutral-100 px-3 py-2 rounded focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="text-neutral-300 block mb-1">Mật khẩu</label>
                <input
                  type="password"
                  value={adminPassInp}
                  onChange={(e) => setAdminPassInp(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#111315] border border-neutral-700 text-neutral-100 px-3 py-2 rounded focus:outline-none focus:border-neutral-500"
                />
              </div>

              {adminLoginError && (
                <div className="p-2 bg-red-950/60 border border-red-800 rounded text-red-300 text-xs">
                  {adminLoginError}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mt-5 w-full py-2 bg-neutral-200 hover:bg-white text-neutral-950 font-semibold rounded text-xs transition"
            >
              Đăng nhập
            </button>
          </form>
        </div>
      )}

      )}
    </div>
  );
}
