import * as XLSX from 'xlsx';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  thumbnailLink?: string;
}

export interface SheetParseResult {
  sheetName: string;
  rows: (string | number | null | undefined)[][];
  totalRows: number;
  totalCols: number;
}

/**
 * Lists Google Sheets & Excel spreadsheets from Google Drive using user's access token.
 */
export async function listDriveSpreadsheets(accessToken?: string): Promise<DriveFileItem[]> {
  if (!accessToken) {
    // Return curated demo Google Drive spreadsheets so the app is immediately testable in preview
    return [
      {
        id: 'drive_sheet_demo_01',
        name: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        modifiedTime: '2025-06-18T10:30:00Z',
      },
      {
        id: 'drive_sheet_demo_02',
        name: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.gsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        modifiedTime: '2025-08-10T14:15:00Z',
      },
      {
        id: 'drive_sheet_demo_03',
        name: 'TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        modifiedTime: '2025-09-02T08:45:00Z',
      },
      {
        id: 'drive_sheet_demo_04',
        name: 'DienDan_DoanhNghiep_CongNgheSo_2025.gsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        modifiedTime: '2025-11-20T16:00:00Z',
      },
    ];
  }

  try {
    const query = encodeURIComponent(
      "mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or name contains '.xlsx' or name contains '.csv'"
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=30&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Google Drive API error:', errText);
      throw new Error(`Google Drive API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size,
    }));
  } catch (err) {
    console.error('Failed to list Drive files:', err);
    throw err;
  }
}

/**
 * Reads data rows from a Google Sheet using the Sheets API v4.
 */
export async function fetchGoogleSheetRows(
  spreadsheetId: string,
  accessToken?: string,
  range: string = 'A1:Z200'
): Promise<SheetParseResult> {
  // If it's a demo sheet or no token, return demo row contents
  if (!accessToken || spreadsheetId.startsWith('drive_sheet_demo')) {
    return getDemoSheetContent(spreadsheetId);
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Sheets API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rows = (data.values || []) as (string | number)[][];
    const totalCols = rows.reduce((max, r) => Math.max(max, r.length), 0);

    return {
      sheetName: 'Sheet1',
      rows,
      totalRows: rows.length,
      totalCols,
    };
  } catch (err) {
    console.error('Failed to fetch Sheets rows:', err);
    throw err;
  }
}

/**
 * Parses a binary Buffer of an uploaded XLSX or CSV file.
 */
export function parseLocalSpreadsheetBuffer(buffer: Buffer): SheetParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: '',
  });

  const totalCols = rows.reduce((max, r) => Math.max(max, (r as any[]).length), 0);

  return {
    sheetName,
    rows,
    totalRows: rows.length,
    totalCols,
  };
}

/**
 * Returns rich mock spreadsheet data for demo files to test schema mapping and entity resolution.
 */
function getDemoSheetContent(sheetId: string): SheetParseResult {
  if (sheetId === 'drive_sheet_demo_01') {
    return {
      sheetName: 'Danh Sách Đại Biểu',
      rows: [
        ['', '', 'BAN TỔ CHỨC HỘI THẢO CHUYỂN ĐỔI SỐ KHU VỰC PHÍA NAM 2025', ''],
        ['', '', 'Ngày tổ chức: 15/06/2025 - Địa điểm: TP. Hồ Chí Minh', ''],
        ['STT', 'Họ và Tên Đại Biểu', 'Đơn Vị Công Tác', 'Chức Danh', 'Địa Chỉ Email', 'Số Điện Thoại'],
        [1, 'TS. Nguyễn Văn An', 'Viện CNTT - Viện Hàn Lâm KH&CN', 'Trưởng phòng AI', 'an.nguyen@vast.gov.vn', '0912345678'],
        [2, 'ThS. Trần Thị Mai Lan', 'Công ty Cổ phần Công nghệ FPT', 'Giám đốc Giải pháp', 'lan.ttm@fpt.com', '0987654321'],
        [3, 'Lê Hoàng Long', 'Sở Khoa học và Công nghệ TP.HCM', 'Phó Trưởng phòng QLCN', 'longlh.skhcn@tphcm.gov.vn', '0903112233'],
        [4, 'PGS.TS. Phạm Minh Tuấn', 'Trường ĐH Bách Khoa TP.HCM', 'Giảng viên cao cấp', 'pmtuan@hcmut.edu.vn', '0938445566'],
        [5, 'Đặng Quốc Bảo', 'Tập đoàn Viettel', 'Kỹ sư trưởng Cloud', 'baodq@viettel.com.vn', '0977889900'],
      ],
      totalRows: 8,
      totalCols: 6,
    };
  }

  if (sheetId === 'drive_sheet_demo_02') {
    return {
      sheetName: 'Speakers & Attendees',
      rows: [
        ['No', 'Full Name', 'Organization', 'Role / Position', 'E-mail Contact', 'Mobile Phone'],
        ['1', 'Nguyen Van An', 'Vien CNTT VAST', 'Head of AI Research Lab', 'an.nguyen@vast.gov.vn', '0912345678'],
        ['2', 'Tran Thi Mai Lan', 'FPT Corporation', 'Solutions Director', 'lan.tran@fpt.com.vn', '0987654321'],
        ['3', 'Pham Minh Tuan', 'HCMUT - Bach Khoa', 'Associate Professor', 'tuanpham.ai@gmail.com', '0938445566'],
        ['4', 'Vo Thi Bich Ngoc', 'Trung tâm Đổi mới sáng tạo Quốc gia (NIC)', 'Chuyên viên Điều phối', 'ngocvtb@nic.gov.vn', '0944556677'],
        ['5', 'Bui Quang Huy', 'Cty TNHH VNPT Technology', 'Trưởng nhóm Data', 'huybq@vnpt.vn', '0966778899'],
      ],
      totalRows: 6,
      totalCols: 6,
    };
  }

  return {
    sheetName: 'DanhSach',
    rows: [
      ['STT', 'Tên Thành Viên', 'Cơ Quan', 'Chức Vụ', 'Hòm Thư', 'Điện Thoại'],
      ['1', 'Ông Lê Hoàng Long', 'Sở KH&CN Thành phố Hồ Chí Minh', 'Phó phòng', 'longlh@gmail.com', '0903112233'],
      ['2', 'Đặng Quốc Bảo', 'Viettel Solutions', 'Chuyên gia Giải pháp', 'baodq@viettel.com.vn', '0977889900'],
      ['3', 'Nguyễn Thị Thu Hà', 'Viện Nghiên cứu ĐMST', 'Nghiên cứu viên', 'ha.ntt@vinrist.org', '0911223344'],
      ['4', 'Hoàng Minh Đức', 'Cổ phần Công nghệ CMC', 'Kỹ sư AI', 'duc.hm@cmc.com.vn', '0922334455'],
    ],
    totalRows: 5,
    totalCols: 6,
  };
}
