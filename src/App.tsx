import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, Briefcase, CheckCircle, XCircle, AlertCircle, Loader2, Upload, ChevronRight, BarChart3, Trash2, ChevronDown, FileUp, History, Clock, Home, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from './lib/api';

// 配置PDF.js worker - 使用本地worker文件
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface AnalysisResult {
  candidateInfo: {
    name: string;
    university: string;
    graduationYear: string;
    major: string;
    experienceYears: number;
  };
  matchScore: number;
  confidence: number;
  summary: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    risks: string;
    stability: string;
    careerProgression: string;
    skillRecency: string;
  };
  interviewQuestions: string[];
  recommendation: string;
  hardRequirementsMet: boolean;
  hardRequirementsNote?: string;
}

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  result?: AnalysisResult;
  error?: string;
}

interface Position {
  id: string;
  name: string;
  createdAt: number;
}

interface HistoryRecord {
  id: string;
  timestamp: number;
  positionName: string;
  jobDescription: string;
  specialRequirements: string;
  results: Array<{
    fileName: string;
    result: AnalysisResult;
  }>;
  assignedTo?: string; // 流转给的用户ID
  createdBy?: string; // 创建者用户ID
}

interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'member';
  position: string;
  createdAt: number;
}

// 从PDF文件中提取文本内容
const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    console.log('开始提取PDF文本:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    console.log('PDF文件大小:', arrayBuffer.byteLength, 'bytes');

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log('PDF页数:', pdf.numPages);

    let fullText = '';

    // 遍历所有页面提取文本
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
      console.log(`第${pageNum}页文本长度:`, pageText.length);
    }

    const trimmedText = fullText.trim();
    console.log('提取的总文本长度:', trimmedText.length);
    return trimmedText;
  } catch (error: any) {
    console.error('PDF文本提取失败:', error);
    console.error('错误详情:', error.message, error.stack);
    throw new Error(`无法读取PDF文件: ${error.message || '未知错误'}`);
  }
};

export default function App() {
  // 认证状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 用户管理
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', position: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // 流转相关
  const [transferRecordId, setTransferRecordId] = useState<string | null>(null);
  const [transferToUserId, setTransferToUserId] = useState<string>('');

  // 删除相关
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<'home' | 'history' | 'positions' | 'permissions'>('home');
  const [jobDescription, setJobDescription] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [candidateType, setCandidateType] = useState<'intern' | 'experienced'>('experienced');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<HistoryRecord | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [newPositionName, setNewPositionName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载历史记录、岗位数据和用户数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载用户数据
        try {
          const usersData = await api.getUsers();
          if (usersData && usersData.length > 0) {
            setUsers(usersData);
            localStorage.setItem('resume-screener-users', JSON.stringify(usersData));
          } else {
            // 初始化默认admin用户
            const defaultAdmin: User = {
              id: 'admin',
              username: 'admin',
              password: 'admin',
              role: 'admin',
              position: '系统管理员',
              createdAt: Date.now()
            };
            await api.createUser(defaultAdmin);
            setUsers([defaultAdmin]);
            localStorage.setItem('resume-screener-users', JSON.stringify([defaultAdmin]));
          }
        } catch (e) {
          console.error('从API加载用户数据失败，使用本地缓存:', e);
          const savedUsers = localStorage.getItem('resume-screener-users');
          if (savedUsers) {
            setUsers(JSON.parse(savedUsers));
          } else {
            // 如果本地缓存也没有，创建默认admin用户
            const defaultAdmin: User = {
              id: 'admin',
              username: 'admin',
              password: 'admin',
              role: 'admin',
              position: '系统管理员',
              createdAt: Date.now()
            };
            setUsers([defaultAdmin]);
            localStorage.setItem('resume-screener-users', JSON.stringify([defaultAdmin]));
          }
        }

        // 检查是否已登录
        const savedCurrentUser = localStorage.getItem('resume-screener-current-user');
        if (savedCurrentUser) {
          try {
            const user = JSON.parse(savedCurrentUser);
            setCurrentUser(user);
            setIsAuthenticated(true);
          } catch (e) {
            console.error('加载当前用户失败:', e);
          }
        }

        // 加载历史记录
        try {
          const historyData = await api.getHistory();
          if (historyData) {
            setHistoryRecords(historyData);
            localStorage.setItem('resume-screener-history', JSON.stringify(historyData));
          }
        } catch (e) {
          console.error('从API加载历史记录失败，使用本地缓存:', e);
          const savedHistory = localStorage.getItem('resume-screener-history');
          if (savedHistory) {
            setHistoryRecords(JSON.parse(savedHistory));
          }
        }

        // 加载职位数据
        try {
          const positionsData = await api.getPositions();
          if (positionsData) {
            setPositions(positionsData);
            localStorage.setItem('resume-screener-positions', JSON.stringify(positionsData));
          }
        } catch (e) {
          console.error('从API加载职位数据失败，使用本地缓存:', e);
          const savedPositions = localStorage.getItem('resume-screener-positions');
          if (savedPositions) {
            setPositions(JSON.parse(savedPositions));
          }
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };

    loadData();
  }, []);

  // 非管理员用户自动跳转到历史记录页面
  useEffect(() => {
    if (isAuthenticated && currentUser?.role !== 'admin' && currentPage !== 'history') {
      setCurrentPage('history');
    }
  }, [isAuthenticated, currentUser, currentPage]);

  // 登录函数
  const handleLogin = () => {
    setLoginError('');
    const user = users.find(u => u.username === loginUsername && u.password === loginPassword);

    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('resume-screener-current-user', JSON.stringify(user));
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  // 登出函数
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('resume-screener-current-user');
    setCurrentPage('home');
  };

  // 用户管理函数
  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      alert('用户名和密码不能为空');
      return;
    }

    if (users.some(u => u.username === newUser.username)) {
      alert('用户名已存在');
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      username: newUser.username.trim(),
      password: newUser.password,
      role: 'member',
      position: newUser.position.trim() || '未指定',
      createdAt: Date.now()
    };

    try {
      await api.createUser(user);
      const updatedUsers = [...users, user];
      setUsers(updatedUsers);
      localStorage.setItem('resume-screener-users', JSON.stringify(updatedUsers));
      setNewUser({ username: '', password: '', position: '' });
    } catch (error) {
      console.error('创建用户失败:', error);
      alert('创建用户失败，请重试');
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === 'admin') {
      alert('不能删除管理员账号');
      return;
    }

    if (confirm('确定要删除该用户吗？')) {
      try {
        await api.deleteUser(userId);
        const updatedUsers = users.filter(u => u.id !== userId);
        setUsers(updatedUsers);
        localStorage.setItem('resume-screener-users', JSON.stringify(updatedUsers));
      } catch (error) {
        console.error('删除用户失败:', error);
        alert('删除用户失败，请重试');
      }
    }
  };

  // 流转记录函数
  const handleTransferRecord = (recordId: string) => {
    setTransferRecordId(recordId);
    setTransferToUserId('');
  };

  const confirmTransfer = async () => {
    if (!transferToUserId) {
      alert('请选择要流转的用户');
      return;
    }

    try {
      if (transferRecordId) {
        await api.updateHistory(transferRecordId, transferToUserId);
      }

      const updatedRecords = historyRecords.map(record => {
        if (record.id === transferRecordId) {
          return { ...record, assignedTo: transferToUserId };
        }
        return record;
      });

      setHistoryRecords(updatedRecords);
      localStorage.setItem('resume-screener-history', JSON.stringify(updatedRecords));
      setTransferRecordId(null);
      setTransferToUserId('');
      alert('流转成功');
    } catch (error) {
      console.error('流转失败:', error);
      alert('流转失败，请重试');
    }
  };

  // 删除记录函数
  const handleDeleteRecord = (recordId: string) => {
    setDeleteRecordId(recordId);
  };

  const confirmDelete = async () => {
    if (!deleteRecordId) return;

    try {
      await api.deleteHistory(deleteRecordId);
      const updatedRecords = historyRecords.filter(record => record.id !== deleteRecordId);
      setHistoryRecords(updatedRecords);
      localStorage.setItem('resume-screener-history', JSON.stringify(updatedRecords));
      setDeleteRecordId(null);
      alert('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 保存历史记录
  const saveToHistory = async (currentFiles: UploadedFile[]) => {
    const successfulResults = currentFiles
      .filter(f => f.status === 'success' && f.result)
      .map(f => ({
        fileName: f.name,
        result: f.result!
      }));

    if (successfulResults.length === 0) {
      console.log('没有成功的结果，不保存历史记录');
      return;
    }

    const positionName = positions.find(p => p.id === selectedPosition)?.name || '未指定岗位';

    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      positionName,
      jobDescription,
      specialRequirements,
      results: successfulResults,
      createdBy: currentUser?.id,
      assignedTo: currentUser?.id // 默认分配给创建者
    };

    console.log('保存历史记录:', newRecord);

    try {
      await api.createHistory(newRecord);
      const updatedHistory = [newRecord, ...historyRecords].slice(0, 50); // 最多保存50条
      setHistoryRecords(updatedHistory);
      localStorage.setItem('resume-screener-history', JSON.stringify(updatedHistory));
      console.log('历史记录已保存，共', updatedHistory.length, '条');
    } catch (error) {
      console.error('保存历史记录失败:', error);
      // 即使API失败，也保存到本地
      const updatedHistory = [newRecord, ...historyRecords].slice(0, 50);
      setHistoryRecords(updatedHistory);
      localStorage.setItem('resume-screener-history', JSON.stringify(updatedHistory));
    }
  };

  // 岗位管理函数
  const addPosition = async () => {
    if (!newPositionName.trim()) return;

    const newPosition: Position = {
      id: Date.now().toString(),
      name: newPositionName.trim(),
      createdAt: Date.now()
    };

    try {
      await api.createPosition(newPosition);
      const updatedPositions = [...positions, newPosition];
      setPositions(updatedPositions);
      localStorage.setItem('resume-screener-positions', JSON.stringify(updatedPositions));
      setNewPositionName('');
    } catch (error) {
      console.error('创建职位失败:', error);
      alert('创建职位失败，请重试');
    }
  };

  const updatePosition = async (id: string, newName: string) => {
    if (!newName.trim()) return;

    try {
      await api.updatePosition(id, newName.trim());
      const updatedPositions = positions.map(p =>
        p.id === id ? { ...p, name: newName.trim() } : p
      );
      setPositions(updatedPositions);
      localStorage.setItem('resume-screener-positions', JSON.stringify(updatedPositions));
      setEditingPosition(null);
    } catch (error) {
      console.error('更新职位失败:', error);
      alert('更新职位失败，请重试');
    }
  };

  const deletePosition = async (id: string) => {
    try {
      await api.deletePosition(id);
      const updatedPositions = positions.filter(p => p.id !== id);
      setPositions(updatedPositions);
      localStorage.setItem('resume-screener-positions', JSON.stringify(updatedPositions));
      if (selectedPosition === id) {
        setSelectedPosition('');
      }
    } catch (error) {
      console.error('删除职位失败:', error);
      alert('删除职位失败，请重试');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf');
      
      if (pdfFiles.length !== selectedFiles.length) {
        setError('仅支持 PDF 格式的文件。');
      }

      if (files.length + pdfFiles.length > 10) {
        setError('一次最多只能上传 10 个 PDF 文件。');
        return;
      }

      const newFileObjs: UploadedFile[] = pdfFiles.map(f => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        status: 'pending'
      }));

      setFiles(prev => [...prev, ...newFileObjs]);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (expandedFileId === id) {
      setExpandedFileId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError('请输入招聘需求。');
      return;
    }
    if (files.length === 0) {
      setError('请上传至少一份候选人简历 (PDF)。');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    const pendingFiles = files.filter(f => f.status !== 'success');
    
    setFiles(prev => prev.map(f => 
      pendingFiles.some(pf => pf.id === f.id) 
        ? { ...f, status: 'analyzing', error: undefined } 
        : f
    ));

    // Process files in parallel
    await Promise.all(pendingFiles.map(async (fileObj) => {
      try {
        // 提取PDF文本内容
        const pdfText = await extractTextFromPDF(fileObj.file);

        if (!pdfText || pdfText.length < 50) {
          throw new Error('PDF内容过少或无法提取，请检查文件');
        }

        const prompt = candidateType === 'intern'
          ? `你是一位拥有 10 年经验的资深校招专家和人才发展顾问。你的任务是对实习生/应届生简历进行深度、专业的潜力评估。

【招聘需求】:
${jobDescription}
${specialRequirements ? `\n【特殊要求（硬性门槛）】:\n${specialRequirements}\n注意：这些是硬性准入条件，不满足则matchScore必须封顶59分，推荐等级降至"不推荐"或"待定"。\n` : ''}

【候选人简历】:
${pdfText}

【分析要求 - 实习生/应届生专用】:

1. **基本信息提取**（必须从简历中仔细提取）：
   - 姓名（从简历顶部或个人信息部分）
   - 毕业院校全称（从教育背景部分）
   - 毕业时间（格式如"2024"或"2024年6月"）
   - 专业名称（从教育背景）
   - 工作年限（填0，因为是实习生/应届生）

2. **硬性门槛校验**（Critical Filters）：
   ${specialRequirements ? '- 首先检查候选人是否满足【特殊要求】中的所有硬性条件\n   - 若不满足任何一项，matchScore自动封顶59分，推荐等级为"不推荐"或"待定"\n   - 在summary开头注明："⚠️ 硬性门槛不符：[具体原因]"' : '- 检查是否有明显的硬性不符（如专业不对口、学历不符等）'}

3. **深度评估维度（针对实习生/应届生）**：

   a) **实践丰富度 (Practice Richness)** - 权重最高：
      - 评估项目经验的数量和质量（课程项目、毕设、竞赛项目、开源贡献）
      - 实习经历的相关性和深度（大厂实习、创业公司实习、科研助理等）
      - 是否有真实的技术产出（GitHub项目、技术博客、论文发表）
      - 项目复杂度和技术深度（是否只是简单的CRUD，还是有架构设计）

   b) **学习能力与成长潜力 (Learning Potential)**：
      - 技术栈的广度和深度（是否主动学习新技术）
      - 自驱力体现（自学项目、参加技术社区、开源贡献）
      - 问题解决能力（项目中遇到的挑战和解决方案）
      - 快速上手能力（短期内掌握多项技能的证据）

   c) **学术表现与基础能力 (Academic Foundation)**：
      - 学校层次（985/211/双一流/普通本科）
      - GPA/成绩排名（如简历中有提及）
      - 获奖情况（奖学金、竞赛获奖、荣誉称号）
      - 专业基础（核心课程成绩、相关证书）

   d) **软实力与团队协作 (Soft Skills)**：
      - 社团/学生组织经历（领导力、组织能力）
      - 团队项目经验（协作能力、沟通能力）
      - 简历表达能力（逻辑清晰度、重点突出度）

   注意：**不要**以"在职时长"、"跳槽频率"等社招标准评估实习生，这些维度对应届生不适用。

4. **评分权重分配（总分100分，针对实习生/应届生）**：
   - 实践丰富度（50%）：项目经验、实习经历的质量和相关性
   - 学习能力与潜力（25%）：自驱力、技术广度、成长速度
   - 学术表现与基础（15%）：学校、GPA、获奖情况
   - 软实力与协作（10%）：团队经验、沟通表达、综合素质

5. **推理链要求**（Chain of Thought）：
   - 重点关注"潜力"而非"经验"，评估候选人的成长空间
   - 识别"真实项目"与"课程作业"的区别，前者价值更高
   - 警惕简历中的"参与了XX项目"等模糊表述，寻找具体的技术细节和个人贡献
   - 对于缺乏实习经历的候选人，重点看项目质量和自学能力

6. **置信度评估**：
   - 当简历格式混乱或内容极度简略时，降低置信度
   - 置信度低于70时，在summary中提醒HR手动复核

7. **面试问题生成**：
   - 基于候选人的项目经历，生成2-3个技术深度验证问题
   - 问题应具体到某个项目的技术细节，避免泛泛而谈
   - 可以包含"如果让你重新做这个项目，你会如何改进"等开放性问题

【输出格式】（严格JSON）：
{
  "candidateInfo": {
    "name": "候选人姓名",
    "university": "毕业院校",
    "graduationYear": "毕业时间",
    "major": "专业",
    "experienceYears": 0
  },
  "matchScore": 匹配度得分（0-100整数，硬性门槛不符时封顶59），
  "confidence": 置信度（0-100整数），
  "summary": "简短总结（80-150字，突出潜力和成长性，硬性门槛不符时开头加⚠️标注）",
  "analysis": {
    "strengths": ["优势1（具体到项目或技能）", "优势2", "优势3"],
    "weaknesses": ["不足1（如缺乏某方面实践）", "不足2"],
    "risks": "风险评估（如：项目经验偏理论、缺乏团队协作经验等）",
    "stability": "稳定性分析（对实习生可填：应届生，稳定性待入职后观察）",
    "careerProgression": "成长潜力评估（学习曲线、技术成长轨迹）",
    "skillRecency": "技能时效性分析（所学技术是否为当前主流技术栈）"
  },
  "interviewQuestions": [
    "面试问题1（针对具体项目的技术细节）",
    "面试问题2（验证学习能力或问题解决能力）",
    "面试问题3（开放性问题，评估思维深度）"
  ],
  "recommendation": "强烈推荐/推荐/待定/不推荐",
  "hardRequirementsMet": true/false,
  "hardRequirementsNote": "硬性门槛检查说明（不符时填写具体原因）"
}

请务必输出完整的JSON，所有字段都必须填写。`
          : `你是一位拥有 10 年经验的资深猎头和技术面试官。你的任务是对候选人简历进行深度、专业的匹配度分析。

【招聘需求】:
${jobDescription}
${specialRequirements ? `\n【特殊要求（硬性门槛）】:\n${specialRequirements}\n注意：这些是硬性准入条件，不满足则matchScore必须封顶59分，推荐等级降至"不推荐"或"待定"。\n` : ''}

【候选人简历】:
${pdfText}

【分析要求】:

1. **基本信息提取**（必须从简历中仔细提取）：
   - 姓名（从简历顶部或个人信息部分）
   - 毕业院校全称（从教育背景部分）
   - 毕业时间（格式如"2020"或"2020年6月"）
   - 专业名称（从教育背景）
   - 工作年限（整数，从工作经历推算）

2. **硬性门槛校验**（Critical Filters）：
   ${specialRequirements ? '- 首先检查候选人是否满足【特殊要求】中的所有硬性条件\n   - 若不满足任何一项，matchScore自动封顶59分，推荐等级为"不推荐"或"待定"\n   - 在summary开头注明："⚠️ 硬性门槛不符：[具体原因]"' : '- 检查是否有明显的硬性不符（如学历造假、经验严重不足等）'}

3. **深度评估维度**：

   a) **稳定性评估 (Stability)**：
      - 分析近3份工作的在职时长
      - 若平均在职时间 < 1.5年，或有2次以上1年内跳槽，在weaknesses中显著标出
      - 评估离职风险和职业稳定性

   b) **职场轨迹 (Career Progression)**：
      - 评估职级是否良性上升（如：专员→高级→主管→经理）
      - 判断成长潜力和自驱力
      - 识别职业发展停滞或倒退的情况

   c) **技能时效性 (Recency)**：
      - 区分"近期核心技能"（3年内使用）与"早期过时技能"（3年以上未用）
      - 如果岗位要求的核心工具候选人已3年未用，应在评分中折算
      - 关注技术栈的更新频率

4. **评分权重分配**（总分100分）：
   - 核心技能匹配（40%）：简历中是否有真实项目支撑该技能，而非简单名词罗列
   - 行业/项目相关性（30%）：过往公司行业、项目复杂度与本岗位的对口程度
   - 教育与稳定性（20%）：学历档次 + 职业生涯连贯性
   - 综合素质/亮点（10%）：沟通表达、大厂背景、获奖情况等

5. **推理链要求**（Chain of Thought）：
   - 在给出最终分数前，先在内部列出JD需求点与候选人经历的"1对1对比表"
   - 警惕简历过度包装，重点寻找具体的"量化结果"（如：提升了30%效率）而非虚词
   - 识别简历中的水分和真实亮点

6. **置信度评估**：
   - 当简历格式混乱（如图片转文字乱码）或内容极度简略时，降低置信度
   - 置信度低于70时，在summary中提醒HR手动复核

7. **面试问题生成**：
   - 基于候选人的"弱点"或"待验证点"，生成2-3个针对性面试问题
   - 问题应具体、可验证，避免泛泛而谈

【输出格式】（严格JSON）：
{
  "candidateInfo": {
    "name": "候选人姓名",
    "university": "毕业院校",
    "graduationYear": "毕业时间",
    "major": "专业",
    "experienceYears": 工作年限（整数）
  },
  "matchScore": 匹配度得分（0-100整数，硬性门槛不符时封顶59），
  "confidence": 置信度（0-100整数），
  "summary": "简短总结（80-150字，硬性门槛不符时开头加⚠️标注）",
  "analysis": {
    "strengths": ["优势1（具体量化）", "优势2", "优势3"],
    "weaknesses": ["不足1（具体指出）", "不足2"],
    "risks": "风险评估（离职风险、学历真实性等）",
    "stability": "稳定性分析（平均任职时长、跳槽频率）",
    "careerProgression": "职场轨迹评估（职级变化、成长潜力）",
    "skillRecency": "技能时效性分析（核心技能使用时间）"
  },
  "interviewQuestions": [
    "面试问题1（针对性强）",
    "面试问题2",
    "面试问题3"
  ],
  "recommendation": "强烈推荐/推荐/待定/不推荐",
  "hardRequirementsMet": true/false,
  "hardRequirementsNote": "硬性门槛检查说明（不符时填写具体原因）"
}

请务必输出完整的JSON，所有字段都必须填写。`;

        // 通过后端API代理调用Deepseek，避免浏览器直连问题
        const apiResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: candidateType === 'intern'
                  ? '你是一位拥有10年经验的资深校招专家和人才发展顾问，擅长识别应届生/实习生的潜力和成长性。你必须客观、严谨，重点评估学习能力和实践经验，而非工作年限。输出必须为中文，并以JSON格式返回。'
                  : '你是一位拥有10年经验的资深猎头和技术面试官，擅长深度分析候选人简历，识别真实能力和潜在风险。你必须客观、严谨，既不过度包装也不过分苛刻。输出必须为中文，并以JSON格式返回。'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.6
          })
        });

        if (!apiResponse.ok) {
          throw new Error(`API请求失败: ${apiResponse.statusText}`);
        }

        const response = await apiResponse.json();

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsedResult = JSON.parse(content) as AnalysisResult;
          setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'success', result: parsedResult } : f));
        } else {
          throw new Error('未能生成分析结果');
        }
      } catch (err: any) {
        console.error(`Error analyzing ${fileObj.name}:`, err);
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', error: err.message || '分析失败' } : f));
      }
    }));

    setIsAnalyzing(false);

    // 获取所有文件的最终状态并保存到历史记录
    setFiles(currentFiles => {
      // 保存历史记录
      saveToHistory(currentFiles);
      return currentFiles;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case '强烈推荐':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> 强烈推荐</span>;
      case '推荐':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> 推荐</span>;
      case '待定':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"><AlertCircle className="w-3 h-3 mr-1" /> 待定</span>;
      case '不推荐':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200"><XCircle className="w-3 h-3 mr-1" /> 不推荐</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">{rec}</span>;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedFileId(prev => prev === id ? null : id);
  };

  return (
    <>
      {!isAuthenticated ? (
        // 登录页面
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Briefcase className="w-7 h-7 text-white" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-white text-center">黄鹂AI简历筛查系统</h1>
                <p className="text-indigo-100 text-center text-sm mt-2">智能招聘助手</p>
              </div>

              <div className="p-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="请输入用户名"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      密码
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="请输入密码"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}

                  <button
                    onClick={handleLogin}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30"
                  >
                    登录
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex">
      {/* 左侧导航栏 */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">黄鹂AI简历筛查系统</h1>
              <p className="text-xs text-slate-500">智能招聘助手</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => setCurrentPage('home')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentPage === 'home'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Home className="w-5 h-5" />
                <span>简历筛查</span>
              </button>

              <button
                onClick={() => setCurrentPage('positions')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentPage === 'positions'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>岗位管理</span>
                {positions.length > 0 && (
                  <span className="ml-auto bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {positions.length}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            onClick={() => setCurrentPage('history')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === 'history'
                ? 'bg-indigo-50 text-indigo-600 font-medium'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <History className="w-5 h-5" />
            <span>{currentUser?.role === 'admin' ? '历史记录' : '筛选结果'}</span>
            {(() => {
              const filteredRecords = historyRecords.filter(r => currentUser?.role === 'admin' || r.assignedTo === currentUser?.id);
              const totalCandidates = filteredRecords.reduce((sum, r) => sum + r.results.length, 0);
              return totalCandidates > 0 && (
                <span className="ml-auto bg-indigo-100 text-indigo-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {totalCandidates}
                </span>
              );
            })()}
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setCurrentPage('permissions')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === 'permissions'
                  ? 'bg-indigo-50 text-indigo-600 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-5 h-5" />
              <span>权限管理</span>
              {users.length > 1 && (
                <span className="ml-auto bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {users.length}
                </span>
              )}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 p-3 bg-slate-50 rounded-lg">
            <div className="text-xs font-medium text-slate-900">{currentUser?.username}</div>
            <div className="text-xs text-slate-500 mt-0.5">{currentUser?.position}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentUser?.role === 'admin' ? '管理员' : '成员'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            退出登录
          </button>
          <p className="text-xs text-slate-500 mt-3 text-center">Powered by Frank</p>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="px-8 h-16 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {currentPage === 'home' ? '简历智能筛查' :
             currentPage === 'positions' ? '岗位管理' :
             currentPage === 'permissions' ? '权限管理' :
             currentUser?.role === 'admin' ? '筛查历史记录' : '筛选结果'}
          </h2>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {currentPage === 'home' && currentUser?.role === 'admin' ? (
          // 简历筛查页面
          <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 space-y-6">
            {/* 岗位选择 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-medium text-slate-900">招聘岗位</h2>
              </div>
              <div className="p-5">
                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                >
                  <option value="">请选择招聘岗位</option>
                  {positions.map(position => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
                {positions.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    暂无岗位，请先在<button onClick={() => setCurrentPage('positions')} className="text-indigo-600 hover:underline">岗位管理</button>中添加
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-medium text-slate-900">招聘需求 (JD)</h2>
              </div>
              <div className="p-5">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="请输入或粘贴职位的详细要求、职责、技能需求等..."
                  className="w-full h-48 p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 特殊要求输入框 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-medium text-slate-900">特殊要求（选填）</h2>
              </div>
              <div className="p-5">
                <textarea
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  placeholder="例如：必须有海外工作经验、需要精通某项特定技术、地域要求等..."
                  className="w-full h-24 p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 候选人类型选择 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-medium text-slate-900">候选人类型</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCandidateType('experienced')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      candidateType === 'experienced'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-1">社招</div>
                      <div className="text-xs">有工作经验</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCandidateType('intern')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      candidateType === 'intern'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-semibold mb-1">实习生/应届生</div>
                      <div className="text-xs">重点评估潜力</div>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  {candidateType === 'experienced'
                    ? '将以工作经验、稳定性、职场轨迹为主要评估维度'
                    : '将以实践丰富度、学习能力、成长潜力为主要评估维度'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  <h2 className="text-base font-medium text-slate-900">候选人简历 (PDF)</h2>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-md">
                  {files.length} / 10
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${files.length >= 10 ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed' : 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-300'}`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    disabled={files.length >= 10 || isAnalyzing}
                  />
                  <FileUp className={`w-8 h-8 mx-auto mb-2 ${files.length >= 10 ? 'text-slate-400' : 'text-indigo-500'}`} />
                  <p className="text-sm font-medium text-slate-700">点击上传 PDF 简历</p>
                  <p className="text-xs text-slate-500 mt-1">支持批量上传，最多 10 份</p>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {files.map(file => (
                        <motion.div 
                          key={file.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 truncate">{file.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            {file.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {file.status === 'analyzing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                            {file.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                            
                            <button 
                              onClick={() => removeFile(file.id)}
                              disabled={isAnalyzing}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !jobDescription.trim() || files.length === 0 || files.every(f => f.status === 'success')}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在深度分析中...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  <span>开始智能筛查</span>
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start space-x-3 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {files.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] bg-white rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 p-8 text-center"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">等待分析</h3>
                  <p className="text-sm max-w-sm">
                    在左侧输入招聘需求并上传候选人简历PDF，点击"开始智能筛查"获取详细的匹配度分析报告。
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {files.map(file => (
                    <div key={file.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* Card Header (Always visible) */}
                      <div 
                        onClick={() => file.status === 'success' ? toggleExpand(file.id) : null}
                        className={`p-4 flex items-center justify-between transition-colors ${file.status === 'success' ? 'cursor-pointer hover:bg-slate-50' : ''} ${file.status === 'success' && expandedFileId === file.id ? getScoreBg(file.result!.matchScore) : ''}`}
                      >
                        <div className="flex items-center space-x-4 overflow-hidden">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            file.status === 'success' ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-100'
                          }`}>
                            {file.status === 'success' ? (
                              <span className={`text-lg font-bold ${getScoreColor(file.result!.matchScore)}`}>
                                {file.result!.matchScore}
                              </span>
                            ) : file.status === 'analyzing' ? (
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            ) : file.status === 'error' ? (
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                            ) : (
                              <FileText className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="truncate">
                            <h3 className="text-sm font-medium text-slate-900 truncate" title={file.name}>{file.name}</h3>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {file.status === 'pending' && '等待分析...'}
                              {file.status === 'analyzing' && 'AI 正在阅读分析中...'}
                              {file.status === 'error' && <span className="text-rose-500">{file.error}</span>}
                              {file.status === 'success' && (
                                <div className="flex items-center space-x-2">
                                  {getRecommendationBadge(file.result!.recommendation)}
                                  <span className="truncate max-w-[200px] sm:max-w-xs">{file.result!.summary}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {file.status === 'success' && (
                          <div className="shrink-0 ml-4">
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedFileId === file.id ? 'rotate-180' : ''}`} />
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {file.status === 'success' && expandedFileId === file.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-100"
                          >
                            <div className="p-6 space-y-6 bg-white">
                              {/* 置信度和硬性门槛提示 */}
                              {(file.result!.confidence < 80 || !file.result!.hardRequirementsMet) && (
                                <div className={`p-3 rounded-lg border ${!file.result!.hardRequirementsMet ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                                  {!file.result!.hardRequirementsMet && (
                                    <div className="flex items-start space-x-2 text-rose-700 text-sm mb-2">
                                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="font-semibold">硬性门槛不符</p>
                                        <p className="text-xs mt-1">{file.result!.hardRequirementsNote}</p>
                                      </div>
                                    </div>
                                  )}
                                  {file.result!.confidence < 80 && (
                                    <div className="flex items-start space-x-2 text-amber-700 text-sm">
                                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                      <p>置信度较低 ({file.result!.confidence}%)，建议人工复核简历原文</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Summary */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                                  评估总结
                                </h4>
                                <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                                  {file.result!.summary}
                                </p>
                              </div>

                              {/* 深度分析维度 */}
                              <div className="grid grid-cols-1 gap-4">
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                  <h5 className="text-xs font-semibold text-blue-700 mb-1">稳定性评估</h5>
                                  <p className="text-sm text-slate-700">{file.result!.analysis.stability}</p>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                  <h5 className="text-xs font-semibold text-purple-700 mb-1">职场轨迹</h5>
                                  <p className="text-sm text-slate-700">{file.result!.analysis.careerProgression}</p>
                                </div>
                                <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100">
                                  <h5 className="text-xs font-semibold text-cyan-700 mb-1">技能时效性</h5>
                                  <p className="text-sm text-slate-700">{file.result!.analysis.skillRecency}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Strengths */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2 flex items-center">
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                    匹配优势
                                  </h4>
                                  <ul className="space-y-2">
                                    {file.result!.analysis.strengths.map((strength, idx) => (
                                      <li key={idx} className="flex items-start text-sm text-slate-700 bg-emerald-50/50 p-2 rounded-md border border-emerald-100/50">
                                        <span className="text-emerald-500 mr-2 mt-0.5">•</span>
                                        <span className="leading-relaxed">{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Weaknesses */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-2 flex items-center">
                                    <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                    缺失或不足
                                  </h4>
                                  <ul className="space-y-2">
                                    {file.result!.analysis.weaknesses.map((weakness, idx) => (
                                      <li key={idx} className="flex items-start text-sm text-slate-700 bg-rose-50/50 p-2 rounded-md border border-rose-100/50">
                                        <span className="text-rose-500 mr-2 mt-0.5">•</span>
                                        <span className="leading-relaxed">{weakness}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* 风险评估 */}
                              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <h5 className="text-xs font-semibold text-amber-700 mb-1 flex items-center">
                                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                  风险评估
                                </h5>
                                <p className="text-sm text-slate-700">{file.result!.analysis.risks}</p>
                              </div>

                              {/* 面试问题建议 */}
                              {file.result!.interviewQuestions && file.result!.interviewQuestions.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2 flex items-center">
                                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                                    建议面试问题
                                  </h4>
                                  <ul className="space-y-2">
                                    {file.result!.interviewQuestions.map((question, idx) => (
                                      <li key={idx} className="flex items-start text-sm text-slate-700 bg-indigo-50/50 p-2 rounded-md border border-indigo-100/50">
                                        <span className="text-indigo-500 mr-2 mt-0.5 font-semibold">{idx + 1}.</span>
                                        <span className="leading-relaxed">{question}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
        ) : currentPage === 'positions' && currentUser?.role === 'admin' ? (
          // 岗位管理页面
          <div className="max-w-4xl mx-auto px-8 py-8">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* 添加岗位 */}
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">添加新岗位</h3>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newPositionName}
                    onChange={(e) => setNewPositionName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPosition()}
                    placeholder="输入岗位名称，如：前端工程师、产品经理..."
                    className="flex-1 p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={addPosition}
                    disabled={!newPositionName.trim()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* 岗位列表 */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  岗位列表 ({positions.length})
                </h3>
                {positions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>暂无岗位，请添加第一个岗位</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((position) => (
                      <div
                        key={position.id}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        {editingPosition?.id === position.id ? (
                          <input
                            type="text"
                            defaultValue={position.name}
                            onBlur={(e) => updatePosition(position.id, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                updatePosition(position.id, (e.target as HTMLInputElement).value);
                              }
                            }}
                            autoFocus
                            className="flex-1 p-2 text-sm bg-white border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        ) : (
                          <div className="flex items-center space-x-3">
                            <Briefcase className="w-5 h-5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">{position.name}</span>
                            <span className="text-xs text-slate-500">
                              创建于 {new Date(position.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          {editingPosition?.id !== position.id && (
                            <button
                              onClick={() => setEditingPosition(position)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`确定要删除岗位"${position.name}"吗？`)) {
                                deletePosition(position.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentPage === 'permissions' && currentUser?.role === 'admin' ? (
          // 权限管理页面
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* 添加成员 */}
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">添加新成员</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="用户名"
                    className="p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="密码"
                    className="p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                  <input
                    type="text"
                    value={newUser.position}
                    onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
                    placeholder="岗位"
                    className="p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={addUser}
                    disabled={!newUser.username.trim() || !newUser.password.trim()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    添加成员
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  注意：添加的成员默认为普通成员角色，不能修改密码，只能查看分配给他们的筛选结果
                </p>
              </div>

              {/* 成员列表 */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  成员列表 ({users.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">用户名</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">岗位</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">角色</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">创建时间</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm text-slate-900">{user.username}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{user.position}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role === 'admin' ? '管理员' : '成员'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="py-3 px-4">
                            {user.id !== 'admin' && (
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                              >
                                删除
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // 历史记录页面
          <div className="max-w-7xl mx-auto px-8 py-8">
            {historyRecords.filter(r => currentUser?.role === 'admin' || r.assignedTo === currentUser?.id).length === 0 ? (
              <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center text-slate-400">
                <Clock className="w-20 h-20 mb-6" />
                <h3 className="text-2xl font-medium text-slate-900 mb-2">暂无历史记录</h3>
                <p className="text-slate-500">完成简历筛查后会自动保存到这里</p>
                <button
                  onClick={() => setCurrentPage('home')}
                  className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  开始筛查
                </button>
              </div>
            ) : selectedHistoryRecord ? (
              // 历史记录详情页
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setSelectedHistoryRecord(null)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">筛查详情</h3>
                    <p className="text-sm text-slate-500">
                      {new Date(selectedHistoryRecord.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>

                {/* 招聘需求和特殊要求 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                      <Briefcase className="w-4 h-4 mr-2" />
                      招聘需求
                    </h4>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedHistoryRecord.jobDescription}
                    </p>
                  </div>

                  {selectedHistoryRecord.specialRequirements && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        特殊要求
                      </h4>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedHistoryRecord.specialRequirements}
                      </p>
                    </div>
                  )}
                </div>

                {/* 候选人分析结果 */}
                <div className="space-y-4">
                  {(() => {
                    const result = selectedHistoryRecord.results[selectedCandidateIndex];
                    if (!result) return null;

                    return (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className={`p-4 flex items-center justify-between ${getScoreBg(result.result.matchScore)}`}>
                        <div className="flex items-center space-x-4">
                          <div className={`w-16 h-16 rounded-lg flex items-center justify-center bg-white border border-slate-200 shadow-sm`}>
                            <span className={`text-2xl font-bold ${getScoreColor(result.result.matchScore)}`}>
                              {result.result.matchScore}
                            </span>
                          </div>
                          <div>
                            <h5 className="text-base font-medium text-slate-900">{result.fileName}</h5>
                            <div className="mt-1">
                              {getRecommendationBadge(result.result.recommendation)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6 bg-white">
                        {/* 置信度和硬性门槛提示 */}
                        {((result.result.confidence && result.result.confidence < 80) || (result.result.hardRequirementsMet === false)) && (
                          <div className={`p-3 rounded-lg border ${result.result.hardRequirementsMet === false ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                            {result.result.hardRequirementsMet === false && result.result.hardRequirementsNote && (
                              <div className="flex items-start space-x-2 text-rose-700 text-sm mb-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-semibold">硬性门槛不符</p>
                                  <p className="text-xs mt-1">{result.result.hardRequirementsNote}</p>
                                </div>
                              </div>
                            )}
                            {result.result.confidence && result.result.confidence < 80 && (
                              <div className="flex items-start space-x-2 text-amber-700 text-sm">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>置信度较低 ({result.result.confidence}%)，建议人工复核简历原文</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Summary */}
                        <div>
                          <h6 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            评估总结
                          </h6>
                          <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {result.result.summary}
                          </p>
                        </div>

                        {/* 深度分析维度 */}
                        {result.result.analysis && (
                          <div className="grid grid-cols-1 gap-4">
                            {result.result.analysis.stability && (
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <h6 className="text-xs font-semibold text-blue-700 mb-1">稳定性评估</h6>
                                <p className="text-sm text-slate-700">{result.result.analysis.stability}</p>
                              </div>
                            )}
                            {result.result.analysis.careerProgression && (
                              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                <h6 className="text-xs font-semibold text-purple-700 mb-1">职场轨迹</h6>
                                <p className="text-sm text-slate-700">{result.result.analysis.careerProgression}</p>
                              </div>
                            )}
                            {result.result.analysis.skillRecency && (
                              <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100">
                                <h6 className="text-xs font-semibold text-cyan-700 mb-1">技能时效性</h6>
                                <p className="text-sm text-slate-700">{result.result.analysis.skillRecency}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Strengths */}
                          <div>
                            <h6 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2 flex items-center">
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                              匹配优势
                            </h6>
                            <ul className="space-y-2">
                              {(result.result.analysis?.strengths || result.result.strengths || []).map((strength, sIdx) => (
                                <li key={sIdx} className="flex items-start text-sm text-slate-700 bg-emerald-50/50 p-2 rounded-md border border-emerald-100/50">
                                  <span className="text-emerald-500 mr-2 mt-0.5">•</span>
                                  <span className="leading-relaxed">{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Weaknesses */}
                          <div>
                            <h6 className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-2 flex items-center">
                              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                              缺失或不足
                            </h6>
                            <ul className="space-y-2">
                              {(result.result.analysis?.weaknesses || result.result.weaknesses || []).map((weakness, wIdx) => (
                                <li key={wIdx} className="flex items-start text-sm text-slate-700 bg-rose-50/50 p-2 rounded-md border border-rose-100/50">
                                  <span className="text-rose-500 mr-2 mt-0.5">•</span>
                                  <span className="leading-relaxed">{weakness}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* 风险评估 */}
                        {result.result.analysis?.risks && (
                          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <h6 className="text-xs font-semibold text-amber-700 mb-1 flex items-center">
                              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                              风险评估
                            </h6>
                            <p className="text-sm text-slate-700">{result.result.analysis.risks}</p>
                          </div>
                        )}

                        {/* 面试问题建议 */}
                        {result.result.interviewQuestions && result.result.interviewQuestions.length > 0 && (
                          <div>
                            <h6 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2 flex items-center">
                              <FileText className="w-3.5 h-3.5 mr-1.5" />
                              建议面试问题
                            </h6>
                            <ul className="space-y-2">
                              {result.result.interviewQuestions.map((question, qIdx) => (
                                <li key={qIdx} className="flex items-start text-sm text-slate-700 bg-indigo-50/50 p-2 rounded-md border border-indigo-100/50">
                                  <span className="text-indigo-500 mr-2 mt-0.5 font-semibold">{qIdx + 1}.</span>
                                  <span className="leading-relaxed">{question}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              // 历史记录列表 - 统一表格形式
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">筛查时间</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">岗位名称</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">姓名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">毕业院校</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">毕业时间</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">专业</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">评分</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">匹配优势</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">缺失或不足</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">建议</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyRecords
                        .filter(r => currentUser?.role === 'admin' || r.assignedTo === currentUser?.id)
                        .flatMap((record) =>
                        record.results.map((result, idx) => (
                          <tr key={`${record.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {new Date(record.timestamp).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-900 font-medium">
                              {record.positionName || '未指定岗位'}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-900 font-medium">
                              {result.result.candidateInfo?.name || '未提供'}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {result.result.candidateInfo?.university || '未提供'}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {result.result.candidateInfo?.graduationYear || '未提供'}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {result.result.candidateInfo?.major || '未提供'}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-12 h-12 rounded-lg font-bold text-lg ${getScoreBg(result.result.matchScore)} ${getScoreColor(result.result.matchScore)}`}>
                                {result.result.matchScore}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700 max-w-xs">
                              <div className="line-clamp-2">
                                {result.result.analysis?.strengths?.slice(0, 2).join('；') || result.result.strengths?.slice(0, 2).join('；') || '暂无数据'}
                                {(result.result.analysis?.strengths?.length || result.result.strengths?.length || 0) > 2 && '...'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700 max-w-xs">
                              <div className="line-clamp-2">
                                {result.result.analysis?.weaknesses?.slice(0, 2).join('；') || result.result.weaknesses?.slice(0, 2).join('；') || '暂无数据'}
                                {(result.result.analysis?.weaknesses?.length || result.result.weaknesses?.length || 0) > 2 && '...'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              {getRecommendationBadge(result.result.recommendation)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedHistoryRecord(record);
                                    setSelectedCandidateIndex(idx);
                                  }}
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>详情</span>
                                </button>
                                {currentUser?.role === 'admin' && (
                                  <>
                                    <button
                                      onClick={() => handleTransferRecord(record.id)}
                                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                      <span>流转</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRecord(record.id)}
                                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>删除</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* 流转对话框 */}
      {transferRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setTransferRecordId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">流转记录</h3>
            <p className="text-sm text-slate-600 mb-4">选择要流转给的用户：</p>
            <select
              value={transferToUserId}
              onChange={(e) => setTransferToUserId(e.target.value)}
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors mb-4"
            >
              <option value="">请选择用户</option>
              {users.filter(u => u.id !== currentUser?.id).map(user => (
                <option key={user.id} value={user.id}>
                  {user.username} - {user.position}
                </option>
              ))}
            </select>
            <div className="flex space-x-3">
              <button
                onClick={() => setTransferRecordId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmTransfer}
                disabled={!transferToUserId}
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                确认流转
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteRecordId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">确认删除</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">确定要删除这条筛查记录吗？此操作无法撤销。</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteRecordId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
      )}
    </>
  );
}
