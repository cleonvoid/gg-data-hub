import { db } from './index.js';
import { RawSourceRecord, CanonicalEntity, EntityLink, MergeSuggestion } from '../../src/types/index.js';
import { generateIdentityEmbedding } from '../services/geminiService.js';
import { buildIdentityString } from '../utils/vietnamese.js';

export async function seedInitialEventData(orgId: string = 'org_default') {
  await db.clearAll(orgId);

  console.log(`Seeding realistic multi-event dataset for ${orgId}...`);

  // 1. Initial canonical entities
  const canonical1 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'TS. Nguyễn Văn An',
    canonicalOrg: 'Viện Công nghệ Thông tin - Viện Hàn lâm KH&CN',
    canonicalRole: 'Trưởng phòng Nghiên cứu Trí tuệ Nhân tạo',
    canonicalEmail: 'an.nguyen@vast.gov.vn',
    canonicalPhone: '0912345678',
    orgId,
  });
  canonical1.aliases = ['TS. Nguyễn Văn An', 'Nguyen Van An', 'Nguyễn V. An'];
  canonical1.alternateOrgs = ['Viện Công nghệ Thông tin - VAST', 'Vien CNTT VAST'];
  canonical1.alternateEmails = ['an.nguyen@vast.gov.vn', 'annguyen.ai.vast@gmail.com'];
  canonical1.eventAppearancesCount = 3;
  canonical1.sourceFilesCount = 3;
  await db.updateCanonicalEntity(orgId, canonical1.id, canonical1);

  const canonical2 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'ThS. Trần Thị Mai Lan',
    canonicalOrg: 'Công ty Cổ phần Công nghệ FPT',
    canonicalRole: 'Giám đốc Giải pháp Chuyển đổi số',
    canonicalEmail: 'lan.ttm@fpt.com',
    canonicalPhone: '0987654321',
    orgId,
  });
  canonical2.aliases = ['ThS. Trần Thị Mai Lan', 'Tran Thi Mai Lan', 'Trần Mai Lan'];
  canonical2.alternateOrgs = ['FPT Corporation', 'Tập đoàn FPT', 'CTCP FPT'];
  canonical2.alternateEmails = ['lan.ttm@fpt.com', 'lan.tran@fpt.com.vn'];
  canonical2.eventAppearancesCount = 3;
  canonical2.sourceFilesCount = 3;
  await db.updateCanonicalEntity(orgId, canonical2.id, canonical2);

  const canonical3 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'PGS.TS. Phạm Minh Tuấn',
    canonicalOrg: 'Trường Đại học Bách Khoa TP.HCM',
    canonicalRole: 'Giảng viên Cao cấp / Viện trưởng Viện AI',
    canonicalEmail: 'pmtuan@hcmut.edu.vn',
    canonicalPhone: '0938445566',
    orgId,
  });
  canonical3.aliases = ['PGS.TS. Phạm Minh Tuấn', 'Pham Minh Tuan', 'TS. Phạm Minh Tuấn'];
  canonical3.alternateOrgs = ['ĐH Bách Khoa TP.HCM', 'HCMUT - Bach Khoa'];
  canonical3.alternateEmails = ['pmtuan@hcmut.edu.vn', 'tuanpham.ai@gmail.com'];
  canonical3.eventAppearancesCount = 2;
  canonical3.sourceFilesCount = 2;
  await db.updateCanonicalEntity(orgId, canonical3.id, canonical3);

  const canonical4 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'Lê Hoàng Long',
    canonicalOrg: 'Sở Khoa học và Công nghệ TP. Hồ Chí Minh',
    canonicalRole: 'Phó Trưởng phòng Quản lý Công nghệ',
    canonicalEmail: 'longlh.skhcn@tphcm.gov.vn',
    canonicalPhone: '0903112233',
    orgId,
  });
  canonical4.aliases = ['Lê Hoàng Long', 'Ông Lê Hoàng Long', 'Le Hoang Long'];
  canonical4.alternateEmails = ['longlh.skhcn@tphcm.gov.vn', 'longlh@gmail.com'];
  canonical4.eventAppearancesCount = 2;
  canonical4.sourceFilesCount = 2;
  await db.updateCanonicalEntity(orgId, canonical4.id, canonical4);

  const canonical5 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'Đặng Quốc Bảo',
    canonicalOrg: 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)',
    canonicalRole: 'Kỹ sư trưởng Cloud & Hạ tầng AI',
    canonicalEmail: 'baodq@viettel.com.vn',
    canonicalPhone: '0977889900',
    orgId,
  });
  canonical5.aliases = ['Đặng Quốc Bảo', 'Dang Quoc Bao'];
  canonical5.alternateOrgs = ['Tập đoàn Viettel', 'Viettel Solutions'];
  canonical5.eventAppearancesCount = 2;
  canonical5.sourceFilesCount = 2;
  await db.updateCanonicalEntity(orgId, canonical5.id, canonical5);

  const canonical6 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'Võ Thị Bích Ngọc',
    canonicalOrg: 'Trung tâm Đổi mới sáng tạo Quốc gia (NIC)',
    canonicalRole: 'Chuyên viên Điều phối Chương trình Đổi mới sáng tạo',
    canonicalEmail: 'ngocvtb@nic.gov.vn',
    canonicalPhone: '0944556677',
    orgId,
  });
  canonical6.eventAppearancesCount = 1;
  canonical6.sourceFilesCount = 1;
  await db.updateCanonicalEntity(orgId, canonical6.id, canonical6);

  const canonical7 = await db.createCanonicalEntity(orgId, {
    entityType: 'person',
    canonicalName: 'Hoàng Minh Đức',
    canonicalOrg: 'Công ty Cổ phần Tập đoàn Công nghệ CMC',
    canonicalRole: 'Chuyên gia Kiến trúc Giải pháp Dữ liệu',
    canonicalEmail: 'duc.hm@cmc.com.vn',
    canonicalPhone: '0922334455',
    orgId,
  });
  canonical7.eventAppearancesCount = 1;
  canonical7.sourceFilesCount = 1;
  await db.updateCanonicalEntity(orgId, canonical7.id, canonical7);

  // 2. Add Raw Source Records across 4 realistic event files
  const rawList: {
    record: RawSourceRecord;
    canonicalId?: string;
  }[] = [
    // File 1: HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx
    {
      record: {
        id: 'raw_001',
        sourceFileId: 'drive_file_001',
        sourceFileName: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 4,
        rawJson: {
          'STT': 1,
          'Họ và Tên Đại Biểu': 'TS. Nguyễn Văn An',
          'Đơn Vị Công Tác': 'Viện CNTT - Viện Hàn Lâm KH&CN',
          'Chức Danh': 'Trưởng phòng AI',
          'Địa Chỉ Email': 'an.nguyen@vast.gov.vn',
          'Số Điện Thoại': '0912345678',
        },
        parsedFields: {
          fullName: 'TS. Nguyễn Văn An',
          organization: 'Viện CNTT - Viện Hàn Lâm KH&CN',
          role: 'Trưởng phòng AI',
          email: 'an.nguyen@vast.gov.vn',
          phone: '0912345678',
          eventName: 'Hội Thảo Chuyển Đổi Số Khu Vực Phía Nam 2025',
          eventDate: '2025-06-15',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'TS. Nguyễn Văn An',
          organization: 'Viện CNTT - Viện Hàn Lâm KH&CN',
          role: 'Trưởng phòng AI',
          email: 'an.nguyen@vast.gov.vn',
        }),
        importedAt: '2025-06-15T08:30:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical1.id,
    },
    {
      record: {
        id: 'raw_002',
        sourceFileId: 'drive_file_001',
        sourceFileName: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 5,
        rawJson: {
          'STT': 2,
          'Họ và Tên Đại Biểu': 'ThS. Trần Thị Mai Lan',
          'Đơn Vị Công Tác': 'Công ty Cổ phần Công nghệ FPT',
          'Chức Danh': 'Giám đốc Giải pháp',
          'Địa Chỉ Email': 'lan.ttm@fpt.com',
          'Số Điện Thoại': '0987654321',
        },
        parsedFields: {
          fullName: 'ThS. Trần Thị Mai Lan',
          organization: 'Công ty Cổ phần Công nghệ FPT',
          role: 'Giám đốc Giải pháp',
          email: 'lan.ttm@fpt.com',
          phone: '0987654321',
          eventName: 'Hội Thảo Chuyển Đổi Số Khu Vực Phía Nam 2025',
          eventDate: '2025-06-15',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'ThS. Trần Thị Mai Lan',
          organization: 'Công ty Cổ phần Công nghệ FPT',
          role: 'Giám đốc Giải pháp',
          email: 'lan.ttm@fpt.com',
        }),
        importedAt: '2025-06-15T08:30:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical2.id,
    },
    {
      record: {
        id: 'raw_003',
        sourceFileId: 'drive_file_001',
        sourceFileName: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 6,
        rawJson: {
          'STT': 3,
          'Họ và Tên Đại Biểu': 'Lê Hoàng Long',
          'Đơn Vị Công Tác': 'Sở Khoa học và Công nghệ TP.HCM',
          'Chức Danh': 'Phó Trưởng phòng QLCN',
          'Địa Chỉ Email': 'longlh.skhcn@tphcm.gov.vn',
          'Số Điện Thoại': '0903112233',
        },
        parsedFields: {
          fullName: 'Lê Hoàng Long',
          organization: 'Sở Khoa học và Công nghệ TP.HCM',
          role: 'Phó Trưởng phòng QLCN',
          email: 'longlh.skhcn@tphcm.gov.vn',
          phone: '0903112233',
          eventName: 'Hội Thảo Chuyển Đổi Số Khu Vực Phía Nam 2025',
          eventDate: '2025-06-15',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Lê Hoàng Long',
          organization: 'Sở Khoa học và Công nghệ TP.HCM',
          role: 'Phó Trưởng phòng QLCN',
          email: 'longlh.skhcn@tphcm.gov.vn',
        }),
        importedAt: '2025-06-15T08:30:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical4.id,
    },
    {
      record: {
        id: 'raw_004',
        sourceFileId: 'drive_file_001',
        sourceFileName: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 7,
        rawJson: {
          'STT': 4,
          'Họ và Tên Đại Biểu': 'PGS.TS. Phạm Minh Tuấn',
          'Đơn Vị Công Tác': 'Trường ĐH Bách Khoa TP.HCM',
          'Chức Danh': 'Giảng viên cao cấp',
          'Địa Chỉ Email': 'pmtuan@hcmut.edu.vn',
          'Số Điện Thoại': '0938445566',
        },
        parsedFields: {
          fullName: 'PGS.TS. Phạm Minh Tuấn',
          organization: 'Trường ĐH Bách Khoa TP.HCM',
          role: 'Giảng viên cao cấp',
          email: 'pmtuan@hcmut.edu.vn',
          phone: '0938445566',
          eventName: 'Hội Thảo Chuyển Đổi Số Khu Vực Phía Nam 2025',
          eventDate: '2025-06-15',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'PGS.TS. Phạm Minh Tuấn',
          organization: 'Trường ĐH Bách Khoa TP.HCM',
          role: 'Giảng viên cao cấp',
          email: 'pmtuan@hcmut.edu.vn',
        }),
        importedAt: '2025-06-15T08:30:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical3.id,
    },
    {
      record: {
        id: 'raw_005',
        sourceFileId: 'drive_file_001',
        sourceFileName: 'HoiThao_ChuyenDoiSo_KhuVucPhiaNam_2025.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 8,
        rawJson: {
          'STT': 5,
          'Họ và Tên Đại Biểu': 'Đặng Quốc Bảo',
          'Đơn Vị Công Tác': 'Tập đoàn Viettel',
          'Chức Danh': 'Kỹ sư trưởng Cloud',
          'Địa Chỉ Email': 'baodq@viettel.com.vn',
          'Số Điện Thoại': '0977889900',
        },
        parsedFields: {
          fullName: 'Đặng Quốc Bảo',
          organization: 'Tập đoàn Viettel',
          role: 'Kỹ sư trưởng Cloud',
          email: 'baodq@viettel.com.vn',
          phone: '0977889900',
          eventName: 'Hội Thảo Chuyển Đổi Số Khu Vực Phía Nam 2025',
          eventDate: '2025-06-15',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Đặng Quốc Bảo',
          organization: 'Tập đoàn Viettel',
          role: 'Kỹ sư trưởng Cloud',
          email: 'baodq@viettel.com.vn',
        }),
        importedAt: '2025-06-15T08:30:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical5.id,
    },

    // File 2: DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx (English columns, no accents)
    {
      record: {
        id: 'raw_006',
        sourceFileId: 'drive_file_002',
        sourceFileName: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 2,
        rawJson: {
          'No': 1,
          'Full Name': 'Nguyen Van An',
          'Organization': 'Vien CNTT VAST',
          'Role / Position': 'Head of AI Research Lab',
          'E-mail Contact': 'an.nguyen@vast.gov.vn',
          'Mobile Phone': '0912345678',
        },
        parsedFields: {
          fullName: 'Nguyen Van An',
          organization: 'Vien CNTT VAST',
          role: 'Head of AI Research Lab',
          email: 'an.nguyen@vast.gov.vn',
          phone: '0912345678',
          eventName: 'Hội Nghị Thượng Đỉnh AI Vietnam Summit 2025',
          eventDate: '2025-08-10',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Nguyen Van An',
          organization: 'Vien CNTT VAST',
          role: 'Head of AI Research Lab',
          email: 'an.nguyen@vast.gov.vn',
        }),
        importedAt: '2025-08-10T09:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical1.id,
    },
    {
      record: {
        id: 'raw_007',
        sourceFileId: 'drive_file_002',
        sourceFileName: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 3,
        rawJson: {
          'No': 2,
          'Full Name': 'Tran Thi Mai Lan',
          'Organization': 'FPT Corporation',
          'Role / Position': 'Solutions Director',
          'E-mail Contact': 'lan.tran@fpt.com.vn',
          'Mobile Phone': '0987654321',
        },
        parsedFields: {
          fullName: 'Tran Thi Mai Lan',
          organization: 'FPT Corporation',
          role: 'Solutions Director',
          email: 'lan.tran@fpt.com.vn',
          phone: '0987654321',
          eventName: 'Hội Nghị Thượng Đỉnh AI Vietnam Summit 2025',
          eventDate: '2025-08-10',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Tran Thi Mai Lan',
          organization: 'FPT Corporation',
          role: 'Solutions Director',
          email: 'lan.tran@fpt.com.vn',
        }),
        importedAt: '2025-08-10T09:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical2.id,
    },
    {
      record: {
        id: 'raw_008',
        sourceFileId: 'drive_file_002',
        sourceFileName: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 4,
        rawJson: {
          'No': 3,
          'Full Name': 'Pham Minh Tuan',
          'Organization': 'HCMUT - Bach Khoa',
          'Role / Position': 'Associate Professor',
          'E-mail Contact': 'tuanpham.ai@gmail.com',
          'Mobile Phone': '0938445566',
        },
        parsedFields: {
          fullName: 'Pham Minh Tuan',
          organization: 'HCMUT - Bach Khoa',
          role: 'Associate Professor',
          email: 'tuanpham.ai@gmail.com',
          phone: '0938445566',
          eventName: 'Hội Nghị Thượng Đỉnh AI Vietnam Summit 2025',
          eventDate: '2025-08-10',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Pham Minh Tuan',
          organization: 'HCMUT - Bach Khoa',
          role: 'Associate Professor',
          email: 'tuanpham.ai@gmail.com',
        }),
        importedAt: '2025-08-10T09:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical3.id,
    },
    {
      record: {
        id: 'raw_009',
        sourceFileId: 'drive_file_002',
        sourceFileName: 'DanhSach_ChuyenGia_HoiNghi_AI_Vietnam.xlsx',
        sourceType: 'drive_sheets',
        rowIndex: 5,
        rawJson: {
          'No': 4,
          'Full Name': 'Vo Thi Bich Ngoc',
          'Organization': 'Trung tâm Đổi mới sáng tạo Quốc gia (NIC)',
          'Role / Position': 'Chuyên viên Điều phối',
          'E-mail Contact': 'ngocvtb@nic.gov.vn',
          'Mobile Phone': '0944556677',
        },
        parsedFields: {
          fullName: 'Vo Thi Bich Ngoc',
          organization: 'Trung tâm Đổi mới sáng tạo Quốc gia (NIC)',
          role: 'Chuyên viên Điều phối',
          email: 'ngocvtb@nic.gov.vn',
          phone: '0944556677',
          eventName: 'Hội Nghị Thượng Đỉnh AI Vietnam Summit 2025',
          eventDate: '2025-08-10',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Vo Thi Bich Ngoc',
          organization: 'Trung tâm Đổi mới sáng tạo Quốc gia (NIC)',
          role: 'Chuyên viên Điều phối',
          email: 'ngocvtb@nic.gov.vn',
        }),
        importedAt: '2025-08-10T09:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical6.id,
    },

    // File 3: TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx
    {
      record: {
        id: 'raw_010',
        sourceFileId: 'local_file_003',
        sourceFileName: 'TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx',
        sourceType: 'local_xlsx',
        rowIndex: 2,
        rawJson: {
          'STT': 1,
          'Tên Thành Viên': 'Ông Lê Hoàng Long',
          'Cơ Quan': 'Sở KH&CN Thành phố Hồ Chí Minh',
          'Chức Vụ': 'Phó phòng',
          'Hòm Thư': 'longlh@gmail.com',
          'Điện Thoại': '0903112233',
        },
        parsedFields: {
          fullName: 'Ông Lê Hoàng Long',
          organization: 'Sở KH&CN Thành phố Hồ Chí Minh',
          role: 'Phó phòng',
          email: 'longlh@gmail.com',
          phone: '0903112233',
          eventName: 'Tập huấn Khởi nghiệp Đổi mới Sáng tạo 2025',
          eventDate: '2025-09-02',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Ông Lê Hoàng Long',
          organization: 'Sở KH&CN Thành phố Hồ Chí Minh',
          role: 'Phó phòng',
          email: 'longlh@gmail.com',
        }),
        importedAt: '2025-09-02T14:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical4.id,
    },
    {
      record: {
        id: 'raw_011',
        sourceFileId: 'local_file_003',
        sourceFileName: 'TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx',
        sourceType: 'local_xlsx',
        rowIndex: 3,
        rawJson: {
          'STT': 2,
          'Tên Thành Viên': 'Đặng Quốc Bảo',
          'Cơ Quan': 'Viettel Solutions',
          'Chức Vụ': 'Chuyên gia Giải pháp',
          'Hòm Thư': 'baodq@viettel.com.vn',
          'Điện Thoại': '0977889900',
        },
        parsedFields: {
          fullName: 'Đặng Quốc Bảo',
          organization: 'Viettel Solutions',
          role: 'Chuyên gia Giải pháp',
          email: 'baodq@viettel.com.vn',
          phone: '0977889900',
          eventName: 'Tập huấn Khởi nghiệp Đổi mới Sáng tạo 2025',
          eventDate: '2025-09-02',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Đặng Quốc Bảo',
          organization: 'Viettel Solutions',
          role: 'Chuyên gia Giải pháp',
          email: 'baodq@viettel.com.vn',
        }),
        importedAt: '2025-09-02T14:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical5.id,
    },
    {
      record: {
        id: 'raw_012',
        sourceFileId: 'local_file_003',
        sourceFileName: 'TapHuan_KhoiNghiep_DoiMoiSangTao_SoKHCN.xlsx',
        sourceType: 'local_xlsx',
        rowIndex: 4,
        rawJson: {
          'STT': 3,
          'Tên Thành Viên': 'Hoàng Minh Đức',
          'Cơ Quan': 'Cổ phần Công nghệ CMC',
          'Chức Vụ': 'Kỹ sư AI',
          'Hòm Thư': 'duc.hm@cmc.com.vn',
          'Điện Thoại': '0922334455',
        },
        parsedFields: {
          fullName: 'Hoàng Minh Đức',
          organization: 'Cổ phần Công nghệ CMC',
          role: 'Kỹ sư AI',
          email: 'duc.hm@cmc.com.vn',
          phone: '0922334455',
          eventName: 'Tập huấn Khởi nghiệp Đổi mới Sáng tạo 2025',
          eventDate: '2025-09-02',
        },
        normalizedIdentityKey: buildIdentityString({
          fullName: 'Hoàng Minh Đức',
          organization: 'Cổ phần Công nghệ CMC',
          role: 'Kỹ sư AI',
          email: 'duc.hm@cmc.com.vn',
        }),
        importedAt: '2025-09-02T14:00:00Z',
        orgId: 'org_default',
      },
      canonicalId: canonical7.id,
    },
  ];

  // Store raw records, generate embeddings, and build links
  for (const item of rawList) {
    const embResult = await generateIdentityEmbedding(item.record.normalizedIdentityKey);
    item.record.embedding = embResult.vector;
    item.record.embeddingSource = embResult.source;
    await db.addRawRecord(item.record);

    if (item.canonicalId) {
      await db.addEntityLink({
        id: `link_seed_${item.record.id}`,
        rawRecordId: item.record.id,
        canonicalEntityId: item.canonicalId,
        status: 'approved',
        stage1SimilarityScore: 0.98,
        stage2Confidence: 0.99,
        adjudicationReason: 'Khởi tạo ban đầu từ nguồn chuẩn hóa',
        decidedBy: 'system_initial',
        createdAt: item.record.importedAt,
        updatedAt: item.record.importedAt,
      });
    }
  }

  // 3. Add 2 Pending Merge Suggestions to demonstrate the Two-Stage Review UI right out of the box!
  const pendingRecord1: RawSourceRecord = {
    id: 'raw_pending_01',
    sourceFileId: 'drive_file_004',
    sourceFileName: 'DienDan_DoanhNghiep_CongNgheSo_2025.xlsx',
    sourceType: 'drive_sheets',
    rowIndex: 5,
    rawJson: {
      'Họ và Tên': 'Nguyễn V. An',
      'Cơ quan': 'Viện CNTT - VAST',
      'Chức vụ': 'Trưởng phòng Nghiên cứu AI',
      'Email': 'annguyen.ai.vast@gmail.com',
      'Điện thoại': '0912345678',
    },
    parsedFields: {
      fullName: 'Nguyễn V. An',
      organization: 'Viện CNTT - VAST',
      role: 'Trưởng phòng Nghiên cứu AI',
      email: 'annguyen.ai.vast@gmail.com',
      phone: '0912345678',
      eventName: 'Diễn Đàn Doanh Nghiệp Công Nghệ Số 2025',
      eventDate: '2025-11-20',
    },
    normalizedIdentityKey: buildIdentityString({
      fullName: 'Nguyễn V. An',
      organization: 'Viện CNTT - VAST',
      role: 'Trưởng phòng Nghiên cứu AI',
      email: 'annguyen.ai.vast@gmail.com',
    }),
    importedAt: '2025-11-20T10:00:00Z',
    orgId,
  };
  const embResult1 = await generateIdentityEmbedding(pendingRecord1.normalizedIdentityKey);
  pendingRecord1.embedding = embResult1.vector;
  pendingRecord1.embeddingSource = embResult1.source;
  await db.addRawRecord(pendingRecord1);

  await db.addPendingSuggestion({
    id: 'sugg_01',
    rawRecord: pendingRecord1,
    targetCanonicalEntity: canonical1,
    vectorSimilarity: 0.94,
    llmConfidence: 0.96,
    llmReasoning:
      'Trùng khớp tên viết tắt lót "Nguyễn V. An" với "TS. Nguyễn Văn An", trùng số điện thoại 0912345678, cùng đơn vị Viện CNTT (VAST), cùng chuyên môn nghiên cứu AI. Email cá nhân annguyen.ai.vast@gmail.com tương thích với danh tính công vụ an.nguyen@vast.gov.vn.',
    keyDifferences: [
      { field: 'Họ tên', rawValue: 'Nguyễn V. An', canonicalValue: 'TS. Nguyễn Văn An' },
      { field: 'Đơn vị', rawValue: 'Viện CNTT - VAST', canonicalValue: 'Viện Công nghệ Thông tin - Viện Hàn lâm KH&CN' },
      { field: 'Email', rawValue: 'annguyen.ai.vast@gmail.com', canonicalValue: 'an.nguyen@vast.gov.vn' },
    ],
    createdAt: new Date().toISOString(),
  });

  const pendingRecord2: RawSourceRecord = {
    id: 'raw_pending_02',
    sourceFileId: 'drive_file_004',
    sourceFileName: 'DienDan_DoanhNghiep_CongNgheSo_2025.xlsx',
    sourceType: 'drive_sheets',
    rowIndex: 8,
    rawJson: {
      'Họ và Tên': 'Trần Mai Lan',
      'Cơ quan': 'Tập đoàn FPT',
      'Chức vụ': 'Giám đốc Giải pháp Chuyển đổi số',
      'Email': 'lan.ttm@fpt.com',
      'Điện thoại': '0987654321',
    },
    parsedFields: {
      fullName: 'Trần Mai Lan',
      organization: 'Tập đoàn FPT',
      role: 'Giám đốc Giải pháp Chuyển đổi số',
      email: 'lan.ttm@fpt.com',
      phone: '0987654321',
      eventName: 'Diễn Đàn Doanh Nghiệp Công Nghệ Số 2025',
      eventDate: '2025-11-20',
    },
    normalizedIdentityKey: buildIdentityString({
      fullName: 'Trần Mai Lan',
      organization: 'Tập đoàn FPT',
      role: 'Giám đốc Giải pháp Chuyển đổi số',
      email: 'lan.ttm@fpt.com',
    }),
    importedAt: '2025-11-20T10:00:00Z',
    orgId,
  };
  const embResult2 = await generateIdentityEmbedding(pendingRecord2.normalizedIdentityKey);
  pendingRecord2.embedding = embResult2.vector;
  pendingRecord2.embeddingSource = embResult2.source;
  await db.addRawRecord(pendingRecord2);

  await db.addPendingSuggestion({
    id: 'sugg_02',
    rawRecord: pendingRecord2,
    targetCanonicalEntity: canonical2,
    vectorSimilarity: 0.95,
    llmConfidence: 0.98,
    llmReasoning:
      'Trùng khớp hoàn toàn địa chỉ email chính thức lan.ttm@fpt.com và số điện thoại 0987654321. Tên "Trần Mai Lan" là biến thể rút gọn của "ThS. Trần Thị Mai Lan", "Tập đoàn FPT" là tên tập đoàn của "Công ty Cổ phần Công nghệ FPT".',
    keyDifferences: [
      { field: 'Họ tên', rawValue: 'Trần Mai Lan', canonicalValue: 'ThS. Trần Thị Mai Lan' },
      { field: 'Đơn vị', rawValue: 'Tập đoàn FPT', canonicalValue: 'Công ty Cổ phần Công nghệ FPT' },
    ],
    createdAt: new Date().toISOString(),
  });

  console.log('Seed completed successfully.');
}
